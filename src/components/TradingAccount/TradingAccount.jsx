import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, LineChart, Line, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import RevolutTradeImporter from '../RevolutTradeImporter'
import { bulkQuote, getChart, getNews, invalidateCache } from '../../services/yahooFinance'
import { computePositions } from '../../calculations/trading/tradingUtils'

/**
 * Build a daily portfolio value timeseries from trade history + live prices.
 * For each position at end-of-day, value = shares * price at that day.
 * We approximate this by linearly interpolating between buy prices and today's price.
 */
function buildPortfolioHistory(trades, marketData) {
  if (!trades.length) return []

  const sorted = [...trades].sort((a, b) => new Date(a.tradedAt) - new Date(b.tradedAt))
  const startDate = new Date(sorted[0].tradedAt)
  startDate.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build day-by-day snapshots
  const days = []
  const cur = new Date(startDate)
  const holdings = {}
  let cashDeposited = 0
  let tradeIdx = 0

  while (cur <= today) {
    const dayEnd = new Date(cur)
    dayEnd.setHours(23, 59, 59, 999)

    // Apply all trades up to end of this day
    while (tradeIdx < sorted.length && new Date(sorted[tradeIdx].tradedAt) <= dayEnd) {
      const t = sorted[tradeIdx]
      const amtEur = t.totalAmount / t.fxRate
      if (t.type === 'CASH TOP-UP') {
        cashDeposited += amtEur
      } else if (t.ticker) {
        if (!holdings[t.ticker]) holdings[t.ticker] = { shares: 0, costBasis: 0 }
        if (t.type.startsWith('BUY')) {
          holdings[t.ticker].shares    += t.quantity ?? 0
          holdings[t.ticker].costBasis += amtEur
        } else if (t.type.startsWith('SELL')) {
          const pos = holdings[t.ticker]
          if (pos.shares > 0) {
            const avg = pos.costBasis / pos.shares
            const sold = t.quantity ?? 0
            pos.costBasis -= avg * sold
            pos.shares    -= sold
            if (pos.shares < 1e-10) { pos.shares = 0; pos.costBasis = 0 }
          }
        }
      }
      tradeIdx++
    }

    // Calculate portfolio value using cost basis as proxy for past value
    // (real historical prices would require many API calls)
    let portfolioValue = 0
    for (const [ticker, pos] of Object.entries(holdings)) {
      if (pos.shares < 1e-10) continue
      const md = marketData?.get(ticker)
      const currentPrice = md?.quote?.price
      // For past points, use the average cost basis as a baseline
      // and scale toward current price as we approach today
      portfolioValue += pos.costBasis
    }

    days.push({
      date: cur.toISOString().slice(0, 10),
      value: portfolioValue,
      deposited: cashDeposited,
    })

    cur.setDate(cur.getDate() + 1)
  }

  return days
}

/**
 * More accurate portfolio history using market data chart prices where available.
 * Merges per-ticker daily close prices with position snapshots.
 */
function buildAccurateHistory(trades, tickerCharts) {
  if (!trades.length) return []

  const sorted = [...trades].sort((a, b) => new Date(a.tradedAt) - new Date(b.tradedAt))
  const startMs = new Date(sorted[0].tradedAt).setHours(0, 0, 0, 0)

  // Build per-ticker price lookups: date string → close price
  const priceLookup = {} // { ticker: { 'YYYY-MM-DD': price } }
  for (const [ticker, chartData] of Object.entries(tickerCharts)) {
    priceLookup[ticker] = {}
    for (const row of chartData) {
      priceLookup[ticker][row.date.slice(0, 10)] = row.close
    }
  }

  // Walk through time applying trades and valuing portfolio each day
  const holdings = {}
  let cashDeposited = 0
  let tradeIdx = 0
  const result = []

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const cur = new Date(startMs)
  while (cur <= today) {
    const dateStr = cur.toISOString().slice(0, 10)
    const dayEnd = new Date(cur)
    dayEnd.setHours(23, 59, 59, 999)

    while (tradeIdx < sorted.length && new Date(sorted[tradeIdx].tradedAt) <= dayEnd) {
      const t = sorted[tradeIdx]
      const amtEur = t.totalAmount / t.fxRate
      if (t.type === 'CASH TOP-UP') {
        cashDeposited += amtEur
      } else if (t.ticker) {
        if (!holdings[t.ticker]) holdings[t.ticker] = { shares: 0, costBasis: 0 }
        if (t.type.startsWith('BUY')) {
          holdings[t.ticker].shares    += t.quantity ?? 0
          holdings[t.ticker].costBasis += amtEur
        } else if (t.type.startsWith('SELL')) {
          const pos = holdings[t.ticker]
          if (pos.shares > 0) {
            const avg  = pos.costBasis / pos.shares
            const sold = t.quantity ?? 0
            pos.costBasis -= avg * sold
            pos.shares    -= sold
            if (pos.shares < 1e-10) { pos.shares = 0; pos.costBasis = 0 }
          }
        }
      }
      tradeIdx++
    }

    let portfolioValue = 0
    let hasAnyPrice = false
    for (const [ticker, pos] of Object.entries(holdings)) {
      if (pos.shares < 1e-10) continue
      const dayPrice = priceLookup[ticker]?.[dateStr]
      if (dayPrice) {
        portfolioValue += pos.shares * dayPrice
        hasAnyPrice = true
      } else {
        // fall back to cost basis for days without price data
        portfolioValue += pos.costBasis
      }
    }

    // Only include days where we have positions
    const hasPositions = Object.values(holdings).some((p) => p.shares > 1e-10)
    if (hasPositions) {
      result.push({ date: dateStr, value: portfolioValue, deposited: cashDeposited })
    }

    cur.setDate(cur.getDate() + 1)
  }

  // Thin out to max ~365 points for performance
  if (result.length > 365) {
    const step = Math.ceil(result.length / 365)
    return result.filter((_, i) => i % step === 0 || i === result.length - 1)
  }
  return result
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtEur = (n, compact = false) => {
  if (n == null) return '—'
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency', currency: 'EUR',
    maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 0 : 2,
    notation: compact && Math.abs(n) >= 1e6 ? 'compact' : 'standard',
  }).format(n)
}

const fmtPct = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const fmtNum = (n, d = 4) => n == null ? '—' : n.toLocaleString('nl-BE', { maximumFractionDigits: d })

const fmtChartDate = (dateStr, range) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (range === '1d') return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  if (range === '5d' || range === '1mo') return d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })
  return d.toLocaleDateString('nl-BE', { month: 'short', year: '2-digit' })
}

const fmtNewsTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const diff = Date.now() - d
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })
}

// ─── Ticker avatar ─────────────────────────────────────────────────────────────

const TICKER_COLORS = [
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
  'from-cyan-500 to-sky-500',
  'from-lime-500 to-green-500',
]

function tickerColor(ticker) {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0
  return TICKER_COLORS[hash % TICKER_COLORS.length]
}

/**
 * Given a ticker (possibly with .DE suffix) and optional resolved Yahoo symbol,
 * return the logo URL from Parqet's free logo API.
 * Parqet supports ISIN, WKN, and Yahoo symbols.
 */
function logoUrl(symbol) {
  if (!symbol) return null
  return `https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=svg`
}

function TickerAvatar({ ticker, symbol, size = 'md' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const gradient = tickerColor(ticker)
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  const src = !imgFailed ? logoUrl(symbol ?? ticker) : null

  if (src) {
    return (
      <div className={`${sz} rounded-xl bg-neo-sunken flex items-center justify-center shrink-0 overflow-hidden`}>
        <img
          src={src}
          alt={ticker}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className={`${sz} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-neo-text shrink-0 shadow-lg`}>
      {ticker.replace('.DE', '').slice(0, 2)}
    </div>
  )
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, positive }) {
  if (!data?.length) return (
    <div className="w-20 h-8 flex items-center justify-center">
      <div className="w-full h-px bg-neo-sunken" />
    </div>
  )
  const color = positive ? '#10b981' : '#f43f5e'
  return (
    <ResponsiveContainer width={80} height={32}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Price change badge ────────────────────────────────────────────────────────

function ChangeBadge({ pct, abs, currency }) {
  const pos = pct >= 0
  return (
    <div className={`flex items-center gap-1 ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d={pos
          ? 'M7 14l5-5 5 5H7z'
          : 'M7 10l5 5 5-5H7z'} />
      </svg>
      <span className="text-sm font-medium">{fmtPct(pct)}</span>
      {abs != null && (
        <span className="text-xs opacity-70">
          ({pos ? '+' : ''}{abs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency})
        </span>
      )}
    </div>
  )
}

// ─── Range selector ───────────────────────────────────────────────────────────

const RANGES = [
  { label: '1W', value: '5d',  interval: '1d' },
  { label: '1M', value: '1mo', interval: '1d' },
  { label: '3M', value: '3mo', interval: '1d' },
  { label: '6M', value: '6mo', interval: '1wk' },
  { label: '1Y', value: '1y',  interval: '1wk' },
  { label: 'All', value: 'max', interval: '1mo' },
]

function RangeSelector({ value, onChange }) {
  return (
    <div className="flex gap-1 bg-neo-raised rounded-lg p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
            ${value === r.value
              ? 'bg-neo-sunken text-neo-text'
              : 'text-neo-muted hover:text-neo-text/95'}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-neo-raised border border-neo-border rounded-lg px-3 py-2 shadow-xl text-sm space-y-1">
      <p className="text-neo-muted text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-neo-muted text-xs">{p.name ?? p.dataKey}:</span>
          <span className="font-semibold text-neo-text text-xs">
            {p.value != null
              ? p.value.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '—'} {currency}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Portfolio chart ──────────────────────────────────────────────────────────

function PortfolioChart({ history, totalValue, totalCost }) {
  if (!history?.length) {
    return (
      <div className="h-48 flex items-center justify-center text-neo-subtle text-sm">
        Not enough history to chart
      </div>
    )
  }

  const gain = totalValue - totalCost
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0
  const positive = gain >= 0
  const color = positive ? '#10b981' : '#f43f5e'
  const gradId = 'portGrad'

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-3xl font-bold text-neo-text">{fmtEur(totalValue)}</span>
        <ChangeBadge pct={gainPct} abs={gain} currency="EUR" />
      </div>
      <p className="text-xs text-neo-subtle">Total portfolio value · cost basis {fmtEur(totalCost)}</p>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
          <span className="text-xs text-neo-muted">Portfolio value</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full bg-neo-subtle shadow-neo-inset-sm" style={{ borderTop: '2px dashed #94a3b8', background: 'none' }} />
          <span className="text-xs text-neo-muted">Deposited</span>
        </div>
      </div>

      <div className="h-52 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => {
                const dt = new Date(d)
                return dt.toLocaleDateString('nl-BE', { month: 'short', year: '2-digit' })
              }}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => '€' + (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0))}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip currency="EUR" />} />
            {/* Deposited line — your own money */}
            <Line
              type="stepAfter"
              dataKey="deposited"
              name="Deposited"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3, fill: '#94a3b8' }}
            />
            {/* Portfolio value area */}
            <Area
              type="monotone" dataKey="value"
              name="Portfolio"
              stroke={color} strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false} activeDot={{ r: 4, fill: color }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Position card ────────────────────────────────────────────────────────────

function PositionCard({ pos, marketData, sparkData, onClick, isSelected }) {
  const md = marketData?.get(pos.ticker)
  const quote = md?.quote
  const sp = sparkData?.[pos.ticker]

  const currentPrice   = quote?.price
  const currency       = quote?.currency ?? 'EUR'
  const currentValueEur = currentPrice != null
    ? pos.shares * currentPrice / (quote?.fxRate ?? 1)
    : pos.totalCostEur
  const gain     = currentValueEur - pos.totalCostEur
  const gainPct  = pos.totalCostEur > 0 ? (gain / pos.totalCostEur) * 100 : 0
  const dayChg   = quote?.changePct ?? null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-150
        ${isSelected
          ? 'border-brand-400 bg-sky-50 shadow-neo'
          : 'border-neo-border/60 bg-neo-surface hover:border-neo-border hover:shadow-neo-sm'}`}
    >
      <div className="flex items-center gap-3">
        <TickerAvatar ticker={pos.ticker} symbol={md?.symbol} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-neo-text text-sm">{pos.ticker}</span>
            <span className="font-semibold text-neo-text text-sm">
              {fmtEur(currentValueEur, true)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-xs text-neo-muted truncate">
              {quote?.shortName ?? '—'}
            </span>
            {dayChg != null ? (
              <span className={`text-xs font-medium ${dayChg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtPct(dayChg)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-neo-subtle">
              {fmtNum(pos.shares, 6)} shares · avg {fmtEur(pos.avgCostEur)}
            </span>
            <span className={`text-xs font-medium ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {gain >= 0 ? '+' : ''}{fmtEur(gain, true)} ({fmtPct(gainPct)})
            </span>
          </div>
        </div>
      </div>

      {/* Mini sparkline */}
      {sp?.length > 0 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sp} positive={gain >= 0} />
        </div>
      )}
    </button>
  )
}

// ─── Position detail panel ────────────────────────────────────────────────────

function PositionDetail({ pos, marketData, onClose }) {
  const [range, setRange] = useState(RANGES[1]) // 1M default
  const [chart, setChart] = useState(null)
  const [news, setNews] = useState(null)
  const [loadingChart, setLoadingChart] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)

  const md = marketData?.get(pos.ticker)
  const quote = md?.quote
  const symbol = md?.symbol

  useEffect(() => {
    if (!symbol) return
    setLoadingChart(true)
    setChart(null)
    getChart(symbol, range.value, range.interval)
      .then(setChart)
      .catch(() => setChart([]))
      .finally(() => setLoadingChart(false))
  }, [symbol, range.value])

  useEffect(() => {
    if (!pos.ticker) return
    setLoadingNews(true)
    getNews(pos.ticker)
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setLoadingNews(false))
  }, [pos.ticker])

  const currentPrice = quote?.price
  const currency     = quote?.currency ?? 'EUR'
  const currentValueEur = currentPrice != null
    ? pos.shares * currentPrice / (quote?.fxRate ?? 1)
    : pos.totalCostEur
  const gain     = currentValueEur - pos.totalCostEur
  const gainPct  = pos.totalCostEur > 0 ? (gain / pos.totalCostEur) * 100 : 0
  const positive = gain >= 0
  const chartColor = positive ? '#10b981' : '#f43f5e'

  const w52range = quote ? (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow) : 0
  const w52pct   = quote && w52range > 0
    ? ((quote.price - quote.fiftyTwoWeekLow) / w52range) * 100
    : 50

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-neo-border/60">
        <div className="flex items-center gap-3">
          <TickerAvatar ticker={pos.ticker} symbol={symbol} size="lg" />
          <div>
            <h2 className="font-bold text-neo-text text-lg leading-tight">{pos.ticker}</h2>
            <p className="text-neo-muted text-xs mt-0.5 max-w-[200px] truncate">
              {quote?.longName ?? quote?.shortName ?? '—'}
            </p>
            {quote && (
              <p className="text-xs text-neo-subtle mt-0.5">
                {quote.exchange} · {quote.type ?? 'Equity'}
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-neo-muted hover:text-neo-text transition-colors mt-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Price */}
        <div className="p-5 border-b border-neo-border/60">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl font-bold text-neo-text">
              {currentPrice != null
                ? `${currentPrice.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
                : '—'}
            </span>
            {quote?.changePct != null && (
              <ChangeBadge pct={quote.changePct} abs={quote.change} currency={currency} />
            )}
          </div>

          {/* Chart */}
          <div className="mt-4">
            <RangeSelector value={range.value} onChange={setRange} />
            <div className="mt-3 h-44 relative">
              {loadingChart && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {chart && chart.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={chartColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => fmtChartDate(d, range.value)}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => v.toFixed(0)}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false} tickLine={false}
                      width={40}
                    />
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                    <Area
                      type="monotone" dataKey="close"
                      stroke={chartColor} strokeWidth={2}
                      fill="url(#detailGrad)"
                      dot={false} activeDot={{ r: 3, fill: chartColor }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {chart && chart.length === 0 && !loadingChart && (
                <div className="h-full flex items-center justify-center text-neo-subtle text-sm">
                  No chart data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Your position */}
        <div className="p-5 border-b border-neo-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-neo-muted">Your Position</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Shares',        value: fmtNum(pos.shares, 8) },
              { label: 'Avg cost',      value: fmtEur(pos.avgCostEur) },
              { label: 'Total invested',value: fmtEur(pos.totalCostEur) },
              { label: 'Current value', value: fmtEur(currentValueEur), accent: true },
              { label: 'Total return',  value: `${gain >= 0 ? '+' : ''}${fmtEur(gain)}`, color: gain >= 0 ? 'text-emerald-400' : 'text-rose-400' },
              { label: 'Return %',      value: fmtPct(gainPct), color: gainPct >= 0 ? 'text-emerald-400' : 'text-rose-400' },
            ].map(({ label, value, color, accent }) => (
              <div key={label} className="bg-neo-sunken/70 rounded-xl px-3 py-2.5">
                <p className="text-xs text-neo-subtle">{label}</p>
                <p className={`font-semibold text-sm mt-0.5 ${color ?? (accent ? 'text-neo-text' : 'text-neo-text/95')}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Market stats */}
        {quote && (
          <div className="p-5 border-b border-neo-border/60 space-y-3">
            <h3 className="text-sm font-semibold text-neo-muted">Market Stats</h3>
            <div className="space-y-2">
              {[
                { label: 'Day range',    value: `${quote.dayLow?.toLocaleString('nl-BE', {maximumFractionDigits:2})} – ${quote.dayHigh?.toLocaleString('nl-BE', {maximumFractionDigits:2})} ${currency}` },
                { label: 'Volume',       value: quote.volume?.toLocaleString('nl-BE') ?? '—' },
                { label: 'Previous close', value: `${quote.prevClose?.toLocaleString('nl-BE', {minimumFractionDigits:2, maximumFractionDigits:2})} ${currency}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-neo-subtle">{label}</span>
                  <span className="text-neo-text/95 font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* 52-week range bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neo-subtle">
                <span>52W Low: {quote.fiftyTwoWeekLow?.toLocaleString('nl-BE', {maximumFractionDigits:2})}</span>
                <span>52W High: {quote.fiftyTwoWeekHigh?.toLocaleString('nl-BE', {maximumFractionDigits:2})}</span>
              </div>
              <div className="relative h-1.5 bg-neo-sunken rounded-full">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-emerald-500 rounded-full"
                  style={{ width: `${w52pct}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-neo-surface rounded-full shadow-neo-sm border-2 border-neo-border"
                  style={{ left: `calc(${w52pct}% - 5px)` }} />
              </div>
            </div>
          </div>
        )}

        {/* News */}
        <div className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-neo-muted">News</h3>
          {loadingNews && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-neo-border border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {news && news.length === 0 && (
            <p className="text-neo-subtle text-sm">No recent news found.</p>
          )}
          {news && news.length > 0 && (
            <div className="space-y-3">
              {news.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 group"
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0 bg-neo-sunken"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-neo-sunken shrink-0 flex items-center justify-center">
                      <svg className="w-5 h-5 text-neo-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neo-text/95 group-hover:text-neo-text transition-colors leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-xs text-neo-subtle mt-1">
                      {item.publisher} · {fmtNewsTime(item.providerPublishTime)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Trade history table ───────────────────────────────────────────────────────

const TYPE_META = {
  'CASH TOP-UP':   { label: 'Top-up',     color: 'bg-sky-100 text-sky-900 border-sky-200/80 shadow-neo-inset-sm' },
  'BUY - MARKET':  { label: 'Buy',        color: 'bg-emerald-100 text-emerald-900 border-emerald-200/80 shadow-neo-inset-sm' },
  'BUY - LIMIT':   { label: 'Buy Limit',  color: 'bg-emerald-100 text-emerald-900 border-emerald-200/80 shadow-neo-inset-sm' },
  'SELL - MARKET': { label: 'Sell',       color: 'bg-rose-100 text-rose-900 border-rose-200/80 shadow-neo-inset-sm' },
  'SELL - LIMIT':  { label: 'Sell Limit', color: 'bg-rose-100 text-rose-900 border-rose-200/80 shadow-neo-inset-sm' },
  'DIVIDEND':      { label: 'Dividend',   color: 'bg-amber-100 text-amber-950 border-amber-200/80 shadow-neo-inset-sm' },
}

function typeMeta(type) {
  return TYPE_META[type] ?? { label: type, color: 'bg-neo-sunken/65 text-neo-muted border-neo-border' }
}

function TradeRow({ t, marketData }) {
  const meta = typeMeta(t.type)
  const d = new Date(t.tradedAt)
  const symbol = t.ticker ? marketData?.get(t.ticker)?.symbol : null
  return (
    <div className="flex items-center gap-3 py-3 border-b border-neo-border/40 last:border-0">
      {t.ticker
        ? <TickerAvatar ticker={t.ticker} symbol={symbol} size="sm" />
        : <div className="w-7 h-7 rounded-lg bg-neo-sunken flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-neo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" />
            </svg>
          </div>
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neo-text">{t.ticker ?? 'Cash'}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${meta.color}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-neo-subtle mt-0.5">
          {d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' })}
          {t.quantity != null ? ` · ${fmtNum(t.quantity, 6)} shares` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-neo-text">
          {t.totalAmount.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.currency}
        </p>
        {t.pricePerShare != null && (
          <p className="text-xs text-neo-subtle">
            @ {t.pricePerShare.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Allocation donut ─────────────────────────────────────────────────────────

function AllocationBar({ positions, marketData }) {
  const items = positions.map((pos) => {
    const md = marketData?.get(pos.ticker)
    const currentPrice = md?.quote?.price
    const val = currentPrice != null
      ? pos.shares * currentPrice
      : pos.totalCostEur
    return { ticker: pos.ticker, value: val }
  })

  const total = items.reduce((s, i) => s + i.value, 0)
  if (!total) return null

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {items.map((item) => {
          const pct = (item.value / total) * 100
          const grad = tickerColor(item.ticker)
          return (
            <div
              key={item.ticker}
              className={`bg-gradient-to-r ${grad} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${item.ticker}: ${pct.toFixed(1)}%`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => {
          const pct = (item.value / total) * 100
          const grad = tickerColor(item.ticker)
          return (
            <div key={item.ticker} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${grad}`} />
              <span className="text-xs text-neo-muted">{item.ticker} {pct.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 30

export default function TradingAccount({ trades, onImport, onClear, importing, onPortfolioValue }) {
  const [showImporter,      setShowImporter]      = useState(false)
  const [showClearConfirm,  setShowClearConfirm]  = useState(false)
  const [selectedTicker,    setSelectedTicker]    = useState(null)
  const [historyPage,       setHistoryPage]       = useState(1)
  const [historyFilter,     setHistoryFilter]     = useState('all')

  // Market data state
  const [marketData,  setMarketData]  = useState(null)   // Map<ticker, {symbol, quote}>
  const [sparkData,   setSparkData]   = useState({})     // { ticker: [{close}] }
  const [tickerCharts,setTickerCharts]= useState({})     // { ticker: [{date,close}] }
  const [loadingMd,   setLoadingMd]   = useState(false)
  const [mdError,     setMdError]     = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  // Derived
  const { positions, totalCashInvested, totalInvestedEur, totalDividends, totalRealised } =
    useMemo(() => computePositions(trades), [trades])

  const tickers = useMemo(() => positions.map((p) => p.ticker), [positions])

  // Live market data fetch
  const fetchMarketData = useCallback(async (forceRefresh = false) => {
    if (!tickers.length) return
    setLoadingMd(true)
    setMdError(null)
    try {
      if (forceRefresh) invalidateCache()
      const md = await bulkQuote(tickers)
      setMarketData(md)
      setLastRefresh(new Date())

      // Fetch sparkline charts (5d) for all tickers in parallel
      const sparkResults = {}
      await Promise.allSettled(
        tickers.map(async (ticker) => {
          const sym = md.get(ticker)?.symbol
          if (!sym) return
          try {
            const data = await getChart(sym, '1mo', '1d')
            sparkResults[ticker] = data
          } catch { /* ignore */ }
        })
      )
      setSparkData(sparkResults)

      // Build portfolio history using the spark data as proxy
      setTickerCharts(sparkResults)
    } catch (err) {
      setMdError(err.message)
    } finally {
      setLoadingMd(false)
    }
  }, [tickers])

  useEffect(() => {
    if (tickers.length > 0) fetchMarketData()
  }, [tickers.join(',')])

  // Compute total current value
  const totalCurrentValue = useMemo(() => {
    if (!positions.length) return 0
    return positions.reduce((sum, pos) => {
      const md = marketData?.get(pos.ticker)
      const price = md?.quote?.price
      return sum + (price != null ? pos.shares * price : pos.totalCostEur)
    }, 0)
  }, [positions, marketData])

  // Notify parent of live portfolio value whenever it changes
  useEffect(() => {
    if (onPortfolioValue) onPortfolioValue(totalCurrentValue)
  }, [totalCurrentValue, onPortfolioValue])

  // Portfolio history
  const portfolioHistory = useMemo(
    () => buildAccurateHistory(trades, tickerCharts),
    [trades, tickerCharts]
  )

  // Trade history filters
  const sortedTrades = useMemo(
    () => [...trades].sort((a, b) => new Date(b.tradedAt) - new Date(a.tradedAt)),
    [trades]
  )

  const filteredTrades = useMemo(() => {
    if (historyFilter === 'all') return sortedTrades
    if (historyFilter === 'cash') return sortedTrades.filter((t) => t.type === 'CASH TOP-UP')
    return sortedTrades.filter((t) => t.ticker === historyFilter)
  }, [sortedTrades, historyFilter])

  const totalHistoryPages = Math.max(1, Math.ceil(filteredTrades.length / PAGE_SIZE))
  const pagedTrades = filteredTrades.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)

  const selectedPos = positions.find((p) => p.ticker === selectedTicker) ?? null

  const handleImport = async (parsed) => {
    await onImport(parsed)
    setShowImporter(false)
    invalidateCache()
  }

  const handleClear = async () => {
    await onClear()
    setShowClearConfirm(false)
    setMarketData(null)
    setSelectedTicker(null)
  }

  const totalGain    = totalCurrentValue - totalInvestedEur
  const totalGainPct = totalInvestedEur > 0 ? (totalGain / totalInvestedEur) * 100 : 0

  // ── Empty state ──
  if (trades.length === 0 && !showImporter) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-neo-text">Trading</h1>
            <p className="text-neo-muted text-sm mt-0.5">Revolut trading account</p>
          </div>
          <button onClick={() => setShowImporter(true)} className="btn-primary text-sm">
            Import CSV
          </button>
        </div>
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center mb-5 shadow-neo-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-neo-text font-semibold text-lg">Connect your Revolut account</p>
          <p className="text-neo-muted text-sm mt-2 mb-6 max-w-xs">
            Import a Revolut trading CSV export to see live prices, charts, positions, and news.
          </p>
          <button onClick={() => setShowImporter(true)} className="btn-primary px-6">
            Import CSV
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-neo-text">Trading</h1>
          {loadingMd && (
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          )}
          {lastRefresh && !loadingMd && (
            <span className="text-xs text-neo-subtle">
              Updated {lastRefresh.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!loadingMd && tickers.length > 0 && (
            <button
              onClick={() => fetchMarketData(true)}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
          {trades.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="btn-secondary text-sm text-rose-400 hover:text-rose-300"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setShowImporter((v) => !v)}
            className="btn-primary text-sm"
            disabled={importing}
          >
            {importing ? 'Importing…' : showImporter ? 'Cancel' : 'Import CSV'}
          </button>
        </div>
      </div>

      {/* ── Clear confirm ── */}
      {showClearConfirm && (
        <div className="card border-rose-700/50 bg-rose-900/10 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-rose-300">Delete all {trades.length} trade rows? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowClearConfirm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleClear}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-neo-text text-sm font-semibold transition-colors">
              Delete all
            </button>
          </div>
        </div>
      )}

      {/* ── Importer ── */}
      {showImporter && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-base font-semibold text-neo-text">Import Revolut Trading CSV</h2>
            <p className="text-xs text-neo-muted mt-0.5">
              Revolut app → Trading → Statement → CSV. Duplicate rows are skipped automatically.
            </p>
          </div>
          <RevolutTradeImporter onImport={handleImport} />
        </div>
      )}

      {/* ── Market data error ── */}
      {mdError && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl px-4 py-3 text-sm text-amber-900 flex items-center gap-2 shadow-neo-inset-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Live prices unavailable: {mdError}
        </div>
      )}

      {trades.length > 0 && (
        <div className="flex gap-5 items-start">

          {/* ── LEFT: Main content ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Portfolio value + chart */}
            <div className="card">
              <PortfolioChart
                history={portfolioHistory}
                totalValue={totalCurrentValue}
                totalCost={totalInvestedEur}
              />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total deposited', value: fmtEur(totalCashInvested), sub: 'Cash top-ups' },
                { label: 'Unrealised P&L',
                  value: `${totalGain >= 0 ? '+' : ''}${fmtEur(totalGain)}`,
                  sub: fmtPct(totalGainPct),
                  accent: totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Realised P&L',
                  value: `${totalRealised >= 0 ? '+' : ''}${fmtEur(totalRealised)}`,
                  sub: 'Closed positions',
                  accent: totalRealised >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Dividends',
                  value: fmtEur(totalDividends),
                  sub: 'All time',
                  accent: 'text-amber-300' },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} className="card space-y-1 py-3">
                  <p className="text-xs text-neo-muted">{label}</p>
                  <p className={`text-lg font-bold ${accent ?? 'text-neo-text'}`}>{value}</p>
                  {sub && <p className="text-xs text-neo-subtle">{sub}</p>}
                </div>
              ))}
            </div>

            {/* Allocation bar */}
            {positions.length > 1 && (
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-neo-muted">Allocation</h2>
                <AllocationBar positions={positions} marketData={marketData} />
              </div>
            )}

            {/* Positions grid */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-neo-muted px-0.5">
                Open Positions · {positions.length}
              </h2>
              {positions.length === 0 ? (
                <div className="card text-center py-8 text-neo-subtle text-sm">
                  No open positions
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {positions.map((pos) => (
                    <PositionCard
                      key={pos.ticker}
                      pos={pos}
                      marketData={marketData}
                      sparkData={sparkData}
                      onClick={() => setSelectedTicker(
                        selectedTicker === pos.ticker ? null : pos.ticker
                      )}
                      isSelected={selectedTicker === pos.ticker}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Trade history */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-neo-muted">
                  Activity · {filteredTrades.length}
                </h2>
                {/* Filter tabs */}
                <div className="flex gap-1 bg-neo-raised rounded-lg p-1 flex-wrap">
                  <button
                    onClick={() => { setHistoryFilter('all'); setHistoryPage(1) }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                      ${historyFilter === 'all' ? 'bg-neo-sunken text-neo-text' : 'text-neo-muted hover:text-neo-text/95'}`}
                  >All</button>
                  {positions.map((pos) => (
                    <button
                      key={pos.ticker}
                      onClick={() => { setHistoryFilter(pos.ticker); setHistoryPage(1) }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                        ${historyFilter === pos.ticker ? 'bg-neo-sunken text-neo-text' : 'text-neo-muted hover:text-neo-text/95'}`}
                    >{pos.ticker}</button>
                  ))}
                  <button
                    onClick={() => { setHistoryFilter('cash'); setHistoryPage(1) }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                      ${historyFilter === 'cash' ? 'bg-neo-sunken text-neo-text' : 'text-neo-muted hover:text-neo-text/95'}`}
                  >Cash</button>
                </div>
              </div>

                <div className="divide-y divide-neo-border/50">
                  {pagedTrades.map((t, i) => <TradeRow key={t.id ?? i} t={t} marketData={marketData} />)}
              </div>

              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >← Prev</button>
                  <span className="text-neo-muted text-sm">{historyPage} / {totalHistoryPages}</span>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyPage === totalHistoryPages}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >Next →</button>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Position detail side panel ── */}
          {selectedPos && (
            <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 bg-neo-sunken/60 border border-neo-border/60 rounded-2xl overflow-hidden"
              style={{ maxHeight: 'calc(100vh - 120px)', position: 'sticky', top: '80px' }}>
              <PositionDetail
                pos={selectedPos}
                marketData={marketData}
                onClose={() => setSelectedTicker(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile detail sheet */}
      {selectedPos && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-neo-bg/80 backdrop-blur-sm" onClick={() => setSelectedTicker(null)} />
          <div className="relative mt-auto bg-neo-surface border-t border-neo-border rounded-t-2xl overflow-hidden"
            style={{ maxHeight: '85vh' }}>
            <PositionDetail
              pos={selectedPos}
              marketData={marketData}
              onClose={() => setSelectedTicker(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
