/**
 * Number and Currency Formatters
 * 
 * Belgian locale formatting for currency and percentages.
 */

/**
 * Format number as EUR currency (Belgian locale)
 * 
 * @param {number} value - Amount to format
 * @returns {string} Formatted currency string (e.g., "€ 125.000")
 */
export function formatEUR(value) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format percentage with sign and 1 decimal
 * 
 * @param {number} value - Percentage value (e.g., 5.2 for 5.2%)
 * @returns {string} Formatted percentage (e.g., "+5.2%")
 */
export function formatPct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

/**
 * Format large numbers with K/M suffixes
 * 
 * @param {number} value - Number to format
 * @returns {string} Formatted number (e.g., "125K", "1.2M")
 */
export function formatCompact(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toFixed(0)
}
