/**
 * Portfolio health score calculation.
 * Returns a 0–100 score based on LTV, monthly cash flow, and diversification.
 */

/**
 * @param {number|null} ltv          - Portfolio LTV percentage (0–100+), or null if no properties
 * @param {number}      monthlyCF    - Current monthly cash flow in EUR
 * @param {number}      propertyCount - Number of live properties
 * @returns {number} Score clamped to [10, 100]
 */
export function computeHealthScore(ltv, monthlyCF, propertyCount) {
  let score = 100

  if (ltv !== null) {
    if      (ltv > 80) score -= 40
    else if (ltv > 65) score -= 25
    else if (ltv > 50) score -= 12
    else if (ltv > 35) score -= 5
  }

  if (monthlyCF < 0)         score -= 18
  else if (monthlyCF > 2000) score = Math.min(100, score + 5)

  if (propertyCount < 2) score -= 5

  return Math.max(10, Math.min(100, Math.round(score)))
}
