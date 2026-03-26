/**
 * Loan-related utilities used across dashboard widgets.
 * Pure functions — no React.
 */

/**
 * Produces a stable key for a loan that survives re-renders.
 * Prefers loan.id when available; falls back to a deterministic composite.
 *
 * @param {Object} property
 * @param {Object} loan
 * @param {number} loanIndex - Position of this loan within property.loans
 * @returns {string}
 */
export function getLoanKey(property, loan, loanIndex) {
  if (loan?.id) return `loan:${loan.id}`
  const propertyKey = property?.id || property?.name || property?.address || 'property'
  return `loan:${propertyKey}:${loanIndex}:${loan?.startDate || ''}:${loan?.monthlyPayment || 0}:${loan?.termMonths || 0}`
}
