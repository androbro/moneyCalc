/**
 * projectionUtils.js
 *
 * Pure calculation helpers for net-worth projection, cash-flow simulation,
 * and scenario analysis (sell vs. hold).
 */

// ─── Loan balance ─────────────────────────────────────────────────────────────

/**
 * Given an amortization schedule and a target date, return the remaining
 * loan balance. Falls back to the annuity formula if no schedule is loaded.
 */
export function getRemainingBalance(loan, targetDate) {
  const { amortizationSchedule = [], originalAmount, interestRate, termMonths, startDate } = loan

  if (amortizationSchedule.length > 0) {
    const target = new Date(targetDate)
    const past = amortizationSchedule
      .filter((e) => new Date(e.dueDate) <= target)
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))

    if (past.length > 0) return Math.max(0, past[0].remainingBalance)
    return originalAmount // before first payment
  }

  return annuityRemainingBalance(
    originalAmount,
    interestRate / 12,
    termMonths,
    monthsBetween(new Date(startDate), new Date(targetDate))
  )
}

/**
 * Annual loan payments in a given year range, used for cash-flow projection.
 * Returns total capital + interest paid across all months that fall in `year`
 * relative to today.
 */
export function getAnnualLoanPayment(loan, year) {
  const today = new Date()
  const yearStart = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())
  const yearEnd   = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())

  const { amortizationSchedule = [], monthlyPayment, termMonths, startDate } = loan

  if (amortizationSchedule.length > 0) {
    return amortizationSchedule
      .filter((e) => {
        const d = new Date(e.dueDate)
        return d >= yearStart && d < yearEnd
      })
      .reduce((sum, e) => sum + e.totalPayment, 0)
  }

  // Fallback: count active months in this year window
  const start = new Date(startDate)
  const endMonth = monthsBetween(start, new Date(start.getFullYear() + Math.ceil(termMonths / 12), start.getMonth(), start.getDate()))
  const windowStart = monthsBetween(start, yearStart)
  const windowEnd   = monthsBetween(start, yearEnd)
  const activeMonths = Math.max(0, Math.min(windowEnd, termMonths) - Math.max(0, windowStart))
  return activeMonths * (monthlyPayment || 0)
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function annuityRemainingBalance(principal, monthlyRate, totalMonths, paidMonths) {
  if (monthlyRate === 0) return Math.max(0, principal * (1 - paidMonths / totalMonths))
  if (paidMonths >= totalMonths) return 0
  const r = monthlyRate
  const N = totalMonths
  const n = Math.max(0, paidMonths)
  return Math.max(0, principal * (Math.pow(1 + r, N) - Math.pow(1 + r, n)) / (Math.pow(1 + r, N) - 1))
}

function monthsBetween(dateA, dateB) {
  return (dateB.getFullYear() - dateA.getFullYear()) * 12 + (dateB.getMonth() - dateA.getMonth())
}

// ─── Main projection ──────────────────────────────────────────────────────────

/**
 * Build the full 20-year projection dataset.
 *
 * Each data point includes:
 *   propertyValue   – total appreciated portfolio value
 *   loanBalance     – total outstanding debt
 *   netWorth        – propertyValue - loanBalance
 *   annualCashFlow  – indexed rent - indexed costs - loan payments (that year)
 *   cumulativeCF    – running total of annualCashFlow
 *
 * New property fields consumed:
 *   indexationRate         – annual rent increase (e.g. 0.02)
 *   annualMaintenanceCost  – maintenance per year (indexed by inflationRate)
 *   annualInsuranceCost    – insurance per year (indexed by inflationRate)
 *   inflationRate          – cost inflation rate (e.g. 0.02)
 *
 * Legacy fields still supported:
 *   monthlyRentalIncome  → used if no startRentalIncome set
 *   monthlyExpenses      → still used as a catch-all
 */
export function buildProjection(properties) {
  const today = new Date()
  const points = []
  let cumulativeCF = 0

  for (let year = 0; year <= 20; year++) {
    const targetDate = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())

    let totalPropertyValue = 0
    let totalLoanBalance   = 0
    let totalAnnualIncome  = 0   // indexed rental income
    let totalAnnualCosts   = 0   // indexed opex + loan payments

    for (const property of properties) {
      // ── Asset value ──
      const appreciated = property.currentValue * Math.pow(1 + (property.appreciationRate || 0.02), year)
      totalPropertyValue += appreciated

      // ── Loan balance ──
      for (const loan of property.loans || []) {
        totalLoanBalance += getRemainingBalance(loan, targetDate.toISOString())
      }

      // ── Indexed rental income ──
      const baseRent = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
      const indexRate = property.indexationRate ?? 0.02
      totalAnnualIncome += baseRent * Math.pow(1 + indexRate, year)

      // ── Indexed operating costs ──
      const inflRate = property.inflationRate ?? 0.02
      const maintenance = (property.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, year)
      const insurance   = (property.annualInsuranceCost || 0) * Math.pow(1 + inflRate, year)
      // Legacy catch-all monthly expenses (also inflate)
      const legacyMonthly = (property.monthlyExpenses || 0) * 12 * Math.pow(1 + inflRate, year)
      totalAnnualCosts += maintenance + insurance + legacyMonthly

      // ── Loan payments (actual cash out that year) ──
      for (const loan of property.loans || []) {
        totalAnnualCosts += getAnnualLoanPayment(loan, year)
      }
    }

    const annualCashFlow = Math.round(totalAnnualIncome - totalAnnualCosts)
    cumulativeCF += annualCashFlow

    points.push({
      year,
      label: year === 0 ? 'Today' : `+${year}y`,
      propertyValue:  Math.round(totalPropertyValue),
      loanBalance:    Math.round(totalLoanBalance),
      netWorth:       Math.round(totalPropertyValue - totalLoanBalance),
      annualCashFlow,
      cumulativeCF:   Math.round(cumulativeCF),
    })
  }

  return points
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

/**
 * Compute current snapshot for KPI cards.
 * New fields returned:
 *   totalPortfolioValue   – same as totalAssets (explicit alias)
 *   totalDebt             – same as totalLiabilities (explicit alias)
 *   roe                   – Return on Equity = annualCashFlow / equity
 */
export function computeSummary(properties) {
  let totalAssets    = 0
  let totalLiabilities = 0
  let annualRentalIncome = 0
  let annualCosts    = 0

  const today = new Date().toISOString()

  for (const property of properties) {
    totalAssets += property.currentValue || 0
    annualRentalIncome += (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
    annualCosts += (property.annualMaintenanceCost || 0)
    annualCosts += (property.annualInsuranceCost || 0)
    annualCosts += (property.monthlyExpenses || 0) * 12

    for (const loan of property.loans || []) {
      totalLiabilities += getRemainingBalance(loan, today)
      annualCosts += (loan.monthlyPayment || 0) * 12
    }
  }

  const equity = totalAssets - totalLiabilities
  const annualNetCF = annualRentalIncome - annualCosts
  const roe = equity > 0 ? (annualNetCF / equity) * 100 : 0

  return {
    totalAssets,
    totalPortfolioValue: totalAssets,
    totalLiabilities,
    totalDebt: totalLiabilities,
    totalNetWorth: equity,
    totalMonthlyCashFlow: annualNetCF / 12,
    annualNetCashFlow: annualNetCF,
    roe,
    propertyCount: properties.length,
    loanCount: properties.reduce((sum, p) => sum + (p.loans?.length || 0), 0),
  }
}

// ─── Scenario analysis ────────────────────────────────────────────────────────

/**
 * Calculate net sale proceeds in a given year.
 *
 * saleYear        – years from today
 * brokeragePct    – agent commission as decimal (e.g. 0.03)
 * registrationPct – Belgian registration/notary fees as decimal (e.g. 0.12)
 * prepaymentPct   – bank penalty as decimal of remaining balance (e.g. 0.02)
 */
export function computeSaleProceeds(properties, saleYear, {
  brokeragePct    = 0.03,
  registrationPct = 0,
  prepaymentPct   = 0.02,
} = {}) {
  const today = new Date()
  const saleDate = new Date(today.getFullYear() + saleYear, today.getMonth(), today.getDate())
  const saleDateISO = saleDate.toISOString()

  let totalSaleValue   = 0
  let totalLoanBalance = 0

  for (const property of properties) {
    const saleValue = property.currentValue * Math.pow(1 + (property.appreciationRate || 0.02), saleYear)
    totalSaleValue += saleValue

    for (const loan of property.loans || []) {
      totalLoanBalance += getRemainingBalance(loan, saleDateISO)
    }
  }

  const brokerage       = totalSaleValue * brokeragePct
  const registration    = totalSaleValue * registrationPct
  const prepaymentPenalty = totalLoanBalance * prepaymentPct

  const netProceeds = totalSaleValue - totalLoanBalance - brokerage - registration - prepaymentPenalty

  return {
    saleYear,
    totalSaleValue:     Math.round(totalSaleValue),
    totalLoanBalance:   Math.round(totalLoanBalance),
    brokerage:          Math.round(brokerage),
    registration:       Math.round(registration),
    prepaymentPenalty:  Math.round(prepaymentPenalty),
    netProceeds:        Math.round(netProceeds),
  }
}

/**
 * Build the Sell-vs-Hold comparison dataset.
 *
 * "Hold" value at year Y  = netWorth from buildProjection (Y)
 * "Sell at X, Reinvest" Y = netProceeds at X, compounded at reinvestRate for (Y - X) years
 *                           If Y < X → same as hold (haven't sold yet)
 */
export function buildScenarioComparison(properties, saleYear, {
  reinvestRate    = 0.05,
  brokeragePct    = 0.03,
  registrationPct = 0,
  prepaymentPct   = 0.02,
} = {}) {
  const projection = buildProjection(properties)
  const sale = computeSaleProceeds(properties, saleYear, { brokeragePct, registrationPct, prepaymentPct })
  const netProceeds = sale.netProceeds

  return projection.map((point) => {
    const holdValue = point.netWorth

    let sellValue
    if (point.year < saleYear) {
      sellValue = holdValue // haven't sold yet — same position
    } else {
      // Proceeds compounded at reinvest rate
      sellValue = Math.round(netProceeds * Math.pow(1 + reinvestRate, point.year - saleYear))
    }

    return {
      ...point,
      holdValue,
      sellValue,
    }
  })
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Format a number as EUR currency string (Belgian locale) */
export function formatEUR(value) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Format a percentage with 1 decimal */
export function formatPct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}
