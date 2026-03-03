/**
 * tradingUtils.js
 *
 * Shared calculation helpers for the Revolut trading account.
 * Imported by both TradingAccount.jsx and App.jsx (for portfolio value).
 */

/**
 * Build position snapshots from a flat list of trade rows.
 *
 * Returns:
 *   positions          – open positions (shares > 0), sorted by total cost desc
 *   totalCashInvested  – sum of CASH TOP-UP rows (EUR)
 *   totalInvestedEur   – sum of cost bases of open positions
 *   totalDividends     – total dividend income (EUR)
 *   totalRealised      – realised P&L from closed / partially-closed positions
 */
export function computePositions(trades) {
  const holdings = {}
  let totalCashInvested = 0
  let totalDividends = 0
  let totalRealised = 0

  const sorted = [...trades].sort((a, b) => new Date(a.tradedAt) - new Date(b.tradedAt))

  for (const t of sorted) {
    const amtEur = t.totalAmount / t.fxRate

    if (t.type === 'CASH TOP-UP') { totalCashInvested += amtEur; continue }
    if (t.type === 'DIVIDEND')    { totalDividends    += amtEur; continue }
    if (!t.ticker) continue

    if (!holdings[t.ticker]) holdings[t.ticker] = { shares: 0, costBasis: 0 }

    if (t.type.startsWith('BUY')) {
      holdings[t.ticker].shares    += t.quantity ?? 0
      holdings[t.ticker].costBasis += amtEur
    } else if (t.type.startsWith('SELL')) {
      const pos = holdings[t.ticker]
      if (pos.shares > 0) {
        const avgCost    = pos.costBasis / pos.shares
        const sold       = t.quantity ?? 0
        totalRealised   += amtEur - avgCost * sold
        pos.costBasis   -= avgCost * sold
        pos.shares      -= sold
        if (pos.shares < 1e-10) { pos.shares = 0; pos.costBasis = 0 }
      }
    }
  }

  const positions = Object.entries(holdings)
    .filter(([, v]) => v.shares > 1e-10)
    .map(([ticker, { shares, costBasis }]) => ({
      ticker,
      shares,
      avgCostEur:   shares > 0 ? costBasis / shares : 0,
      totalCostEur: costBasis,
    }))
    .sort((a, b) => b.totalCostEur - a.totalCostEur)

  return {
    positions,
    totalCashInvested,
    totalInvestedEur: positions.reduce((s, p) => s + p.totalCostEur, 0),
    totalDividends,
    totalRealised,
  }
}

/**
 * Compute total current portfolio value in EUR given open positions and a
 * live market-data Map (ticker → { quote: { price, fxRate? } }).
 * Falls back to cost basis for any ticker without live price.
 */
export function computePortfolioValue(positions, marketData) {
  return positions.reduce((sum, pos) => {
    const md    = marketData?.get(pos.ticker)
    const price = md?.quote?.price
    return sum + (price != null ? pos.shares * price : pos.totalCostEur)
  }, 0)
}

/**
 * Build a 20-year trading portfolio projection from trade history.
 *
 * @param {Array}  trades          – raw trade rows (same shape as computePositions input)
 * @param {number} currentValue    – current portfolio value in EUR (live or cost-basis fallback)
 * @param {number} years           – projection horizon (default 20)
 * @param {number} annualReturn    – assumed annual return rate (default 0.07 = 7%)
 *
 * Returns an array of { year, tradingProjection } objects (year 0 … years).
 *
 * Formula per year Y:
 *   lumpSumFV   = currentValue × (1 + annualReturn)^Y
 *   annuityFV   = monthlyAvg × ((1 + r/12)^(Y×12) − 1) / (r/12)   where r = annualReturn
 *   tradingProjection = lumpSumFV + annuityFV
 *
 * Average monthly buy is computed from BUY trades:
 *   – group BUY rows by calendar month
 *   – sum EUR amounts per month
 *   – divide by the number of distinct months observed
 */
export function buildTradingProjection(trades = [], currentValue = 0, years = 20, annualReturn = 0.07) {
  // Compute average monthly buy amount from trade history
  const monthlyBuys = {}
  for (const t of trades) {
    if (!t.type?.startsWith('BUY')) continue
    const d = new Date(t.tradedAt)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const amtEur = (t.totalAmount ?? 0) / (t.fxRate ?? 1)
    monthlyBuys[key] = (monthlyBuys[key] ?? 0) + amtEur
  }

  const monthKeys   = Object.keys(monthlyBuys)
  const monthlyAvg  = monthKeys.length > 0
    ? Object.values(monthlyBuys).reduce((s, v) => s + v, 0) / monthKeys.length
    : 0

  const r = annualReturn / 12  // monthly rate

  const result = []
  for (let y = 0; y <= years; y++) {
    const n = y * 12
    const lumpSumFV = currentValue * Math.pow(1 + annualReturn, y)
    const annuityFV = r === 0
      ? monthlyAvg * n
      : monthlyAvg * (Math.pow(1 + r, n) - 1) / r
    result.push({ year: y, tradingProjection: Math.round(lumpSumFV + annuityFV) })
  }
  return result
}
