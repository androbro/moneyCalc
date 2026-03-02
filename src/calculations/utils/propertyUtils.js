/**
 * Property Utility Functions
 * 
 * Functions to determine property status and rental activity.
 */

/**
 * Check if rental income is active for a property on a specific date
 * 
 * Considers:
 * - Property status (must be 'rented')
 * - Rental start date (if set, must be on or before target date)
 * - Rental end date (if set, must be on or after target date)
 * 
 * @param {Object} property - Property object with status, rentalStartDate, rentalEndDate
 * @param {Date} date - Target date (defaults to today)
 * @returns {boolean} True if rental is active
 */
export function isRentalActiveOn(property, date = new Date()) {
  if (property.status && property.status !== 'rented') {
    return false
  }
  
  // Legacy: if no status field, fall back to isRented boolean
  if (!property.status && property.isRented === false) {
    return false
  }
  
  if (property.rentalStartDate && new Date(property.rentalStartDate) > date) {
    return false
  }
  
  if (property.rentalEndDate && new Date(property.rentalEndDate) < date) {
    return false
  }
  
  return true
}

/**
 * Check if property is primary residence on a specific date
 * 
 * @param {Object} property - Property object
 * @param {Date} date - Target date
 * @returns {boolean} True if property is primary residence
 */
export function isPrimaryResidenceOn(property, date = new Date()) {
  if (property.status !== 'owner_occupied') {
    return false
  }
  
  if (property.occupancyStartDate && new Date(property.occupancyStartDate) > date) {
    return false
  }
  
  if (property.occupancyEndDate && new Date(property.occupancyEndDate) < date) {
    return false
  }
  
  return true
}

/**
 * Get ownership share for a specific person
 * 
 * @param {Object} property - Property object with owners array
 * @param {string} personName - Name to match (case-insensitive)
 * @returns {number} Ownership share (0-1), defaults to 1 if no owners array
 */
export function getOwnershipShare(property, personName = 'Me') {
  const owners = property.owners || [{ name: 'Me', share: 1 }]
  const owner = owners.find(o => 
    o.name?.trim().toLowerCase() === personName.toLowerCase()
  ) ?? owners[0]
  
  return Number(owner?.share ?? 1)
}
