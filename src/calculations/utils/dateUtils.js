/**
 * Date Utility Functions
 * 
 * Common date manipulation functions used across calculations.
 */

/**
 * Calculate number of months between two dates
 * 
 * @param {Date} dateA - Start date
 * @param {Date} dateB - End date
 * @returns {number} Number of months between dates
 */
export function monthsBetween(dateA, dateB) {
  return (
    (dateB.getFullYear() - dateA.getFullYear()) * 12 +
    (dateB.getMonth() - dateA.getMonth())
  )
}

/**
 * Add years to a date
 * 
 * @param {Date} date - Base date
 * @param {number} years - Number of years to add
 * @returns {Date} New date with years added
 */
export function addYears(date, years) {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
}

/**
 * Check if date is within a date range
 * 
 * @param {Date} date - Date to check
 * @param {Date|null} startDate - Range start (null means no lower bound)
 * @param {Date|null} endDate - Range end (null means no upper bound)
 * @returns {boolean} True if date is within range
 */
export function isDateInRange(date, startDate, endDate) {
  if (startDate && date < startDate) return false
  if (endDate && date > endDate) return false
  return true
}
