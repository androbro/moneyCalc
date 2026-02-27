/**
 * projectionUtils.js
 *
 * Pure calculation helpers for the 20-year net worth projection.
 */

/**
 * Given an amortization schedule array and a target date,
 * return the remaining loan balance at that date.
 *
 * Falls back to annuity formula if schedule is empty.
 */
export function getRemainingBalance(loan, targetDate) {
  const { amortizationSchedule = [], originalAmount, interestRate, termMonths, startDate } = loan

  if (amortizationSchedule.length > 0) {
    // Find the last schedule entry whose dueDate <= targetDate
    const target = new Date(targetDate)
    const past = amortizationSchedule
      .filter((entry) => new Date(entry.dueDate) <= target)
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))

    if (past.length > 0) return Math.max(0, past[0].remainingBalance)

    // Target date is before the first payment — full balance
    return originalAmount
  }

  // Fallback: standard annuity remaining balance formula
  return annuityRemainingBalance(
    originalAmount,
    interestRate / 12,
    termMonths,
    monthsBetween(new Date(startDate), new Date(targetDate))
  )
}

/**
 * Standard annuity remaining balance after `n` payments.
 * B(n) = P * [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
 */
function annuityRemainingBalance(principal, monthlyRate, totalMonths, paidMonths) {
  if (monthlyRate === 0) {
    return Math.max(0, principal * (1 - paidMonths / totalMonths))
  }
  if (paidMonths >= totalMonths) return 0
  const r = monthlyRate
  const N = totalMonths
  const n = Math.max(0, paidMonths)
  const numerator = Math.pow(1 + r, N) - Math.pow(1 + r, n)
  const denominator = Math.pow(1 + r, N) - 1
  return Math.max(0, principal * (numerator / denominator))
}

function monthsBetween(dateA, dateB) {
  return (
    (dateB.getFullYear() - dateA.getFullYear()) * 12 +
    (dateB.getMonth() - dateA.getMonth())
  )
}

/**
 * Build the 20-year projection dataset for recharts.
 *
 * @param {Property[]} properties
 * @returns {{ year: number, propertyValue: number, loanBalance: number, netWorth: number }[]}
 */
export function buildProjection(properties) {
  const today = new Date()
  const points = []

  for (let year = 0; year <= 20; year++) {
    const targetDate = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())

    let totalPropertyValue = 0
    let totalLoanBalance = 0

    for (const property of properties) {
      // Appreciate from currentValue
      const appreciated =
        property.currentValue * Math.pow(1 + (property.appreciationRate || 0.02), year)
      totalPropertyValue += appreciated

      for (const loan of property.loans || []) {
        totalLoanBalance += getRemainingBalance(loan, targetDate.toISOString())
      }
    }

    points.push({
      year,
      label: year === 0 ? 'Today' : `+${year}y`,
      propertyValue: Math.round(totalPropertyValue),
      loanBalance: Math.round(totalLoanBalance),
      netWorth: Math.round(totalPropertyValue - totalLoanBalance),
    })
  }

  return points
}

/**
 * Compute current-month totals for the dashboard KPI cards.
 */
export function computeSummary(properties) {
  let totalAssets = 0
  let totalLiabilities = 0
  let totalMonthlyIncome = 0
  let totalMonthlyExpenses = 0

  const today = new Date().toISOString()

  for (const property of properties) {
    totalAssets += property.currentValue || 0
    totalMonthlyIncome += property.monthlyRentalIncome || 0
    totalMonthlyExpenses += property.monthlyExpenses || 0

    for (const loan of property.loans || []) {
      totalLiabilities += getRemainingBalance(loan, today)
      totalMonthlyExpenses += loan.monthlyPayment || 0
    }
  }

  return {
    totalAssets,
    totalLiabilities,
    totalNetWorth: totalAssets - totalLiabilities,
    totalMonthlyCashFlow: totalMonthlyIncome - totalMonthlyExpenses,
    propertyCount: properties.length,
    loanCount: properties.reduce((sum, p) => sum + (p.loans?.length || 0), 0),
  }
}

/** Format a number as EUR currency string */
export function formatEUR(value) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}
