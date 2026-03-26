/**
 * Chart data generators for the Dashboard projection chart widget.
 * Each function returns an array of { label, value, year } data points.
 * Pure functions — no React.
 */

import { buildProjection, getRemainingBalance, getAnnualLoanPayment } from '../../../utils/projectionUtils'
import { getLoanKey } from './loanUtils'

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toValidDate(dateLike) {
  if (!dateLike) return null
  const parsed = new Date(dateLike)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getOwnershipFractionInWindow(property, windowStart, windowEnd) {
  const purchaseDate = toValidDate(property.purchaseDate)
  if (!purchaseDate) return property.status === 'planned' ? 0 : 1
  if (purchaseDate >= windowEnd)   return 0
  if (purchaseDate <= windowStart) return 1
  const activeMs = windowEnd.getTime() - purchaseDate.getTime()
  const totalMs  = windowEnd.getTime() - windowStart.getTime()
  if (totalMs <= 0) return 0
  return Math.max(0, Math.min(1, activeMs / totalMs))
}

/**
 * @param {Array}    properties
 * @param {number}   years
 * @param {Function} perPointFn - (liveProperties, yearIndex, futureISO) => number
 * @returns {Array<{label: string, value: number, year: number}>}
 */
function _projectPoints(properties, years, perPointFn) {
  const today    = new Date()
  const liveProp = properties.filter((p) => p.status !== 'planned')
  return Array.from({ length: years + 1 }, (_, i) => {
    const futureDate = new Date(today.getFullYear() + i, today.getMonth(), 1)
    const futureISO  = futureDate.toISOString()
    const label      = i === 0 ? 'Now' : `${futureDate.getFullYear()}`
    const value      = perPointFn(liveProp, i, futureISO)
    return { label, value: Math.round(value), year: i }
  })
}

// ─── Public generators ────────────────────────────────────────────────────────

/**
 * Portfolio net worth over time (property appreciation minus loan paydown).
 * @param {Array}  properties
 * @param {number} personalCash
 * @param {number} [years=10]
 */
export function generateNetWorthProjection(properties, personalCash, years = 10) {
  return _projectPoints(properties, years, (liveProp, i, futureISO) => {
    let totalValue = 0
    let totalDebt  = 0
    liveProp.forEach((p) => {
      const appRate   = (parseFloat(p.appreciationRate) || 3) / 100
      totalValue += (p.currentValue || 0) * Math.pow(1 + appRate, i)
      totalDebt  += (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, futureISO), 0)
    })
    return totalValue - totalDebt + (personalCash || 0)
  })
}

/**
 * 80% LTV equity headroom plus liquid cash over time.
 * @param {Array}  properties
 * @param {number} personalCash
 * @param {number} [years=10]
 */
export function generateInvestmentReadyProjection(properties, personalCash, years = 10) {
  const LTV = 0.80
  return _projectPoints(properties, years, (liveProp, i, futureISO) => {
    let equity = 0
    liveProp.forEach((p) => {
      const appRate   = (parseFloat(p.appreciationRate) || 3) / 100
      const futureVal  = (p.currentValue || 0) * Math.pow(1 + appRate, i)
      const futureDebt = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, futureISO), 0)
      equity += Math.max(0, futureVal * LTV - futureDebt)
    })
    return equity + (personalCash || 0)
  })
}

/**
 * Monthly net cash flow projection using the portfolio projection engine.
 * Optionally excludes some loans from the cash flow via includedLoanKeys set.
 *
 * @param {Array}     properties
 * @param {number}    [years=10]
 * @param {Set|null}  [includedLoanKeys=null] - If provided, only these loans are counted
 */
export function generateCashFlowProjection(properties, years = 10, includedLoanKeys = null) {
  const today         = new Date()
  const todayYear     = today.getFullYear()
  const projectionPoints = buildProjection(properties)
  const maxYear       = Math.max(0, Math.min(years, projectionPoints.length - 1))
  const yearCount     = maxYear + 1
  const excludedByYear = new Array(yearCount).fill(0)

  if (includedLoanKeys && includedLoanKeys.size > 0) {
    properties.forEach((property) => {
      ;(property.loans || []).forEach((loan, idx) => {
        const loanKey = getLoanKey(property, loan, idx)
        if (includedLoanKeys.has(loanKey)) return
        for (let year = 0; year < yearCount; year++) {
          const yearStart = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())
          const yearEnd   = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())
          const fraction  = getOwnershipFractionInWindow(property, yearStart, yearEnd)
          if (fraction <= 0) continue
          excludedByYear[year] += getAnnualLoanPayment(loan, year) * fraction
        }
      })
    })
  }

  return projectionPoints.slice(0, maxYear + 1).map((pt) => ({
    label: pt.year === 0 ? 'Now' : `${todayYear + pt.year}`,
    value: Math.round(((pt.annualCashFlow || 0) + excludedByYear[pt.year]) / 12),
    year:  pt.year,
  }))
}
