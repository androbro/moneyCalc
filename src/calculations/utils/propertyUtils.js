/**
 * Property Utility Functions
 * 
 * Functions to determine property status and rental activity.
 */

/**
 * Check if rental income is active for a property on a specific date
 * 
 * Considers:
 * - Rental intent (rented status, legacy isRented, intendedRental, or rentalStartDate)
 * - Rental start/end dates
 * - Owner-occupied transition into rental mode
 * - Planned status exclusion
 * 
 * @param {Object} property - Property object with status, rentalStartDate, rentalEndDate
 * @param {Date} date - Target date (defaults to today)
 * @returns {boolean} True if rental is active
 */
export function isRentalActiveOn(property, date = new Date()) {
  const targetDate = new Date(date)
  const hasRentalIntent =
    property.status === 'rented' ||
    property.isRented === true ||
    property.intendedRental === true ||
    Boolean(property.rentalStartDate)

  // No rental intent at all -> never active.
  if (!hasRentalIntent) {
    return false
  }

  // Planned/simulated properties are not active rentals until owned.
  // Ownership timing is handled elsewhere; this prevents accidental "always rented".
  if (property.status === 'planned') {
    return false
  }

  if (property.rentalStartDate && new Date(property.rentalStartDate) > targetDate) {
    return false
  }

  if (property.rentalEndDate && new Date(property.rentalEndDate) < targetDate) {
    return false
  }

  // Owner-occupied properties can transition into rented mode when a rental start date is set.
  // Without a rental start date, owner-occupied means no rental income.
  if (property.status === 'owner_occupied') {
    if (!property.rentalStartDate) return false
    if (property.residenceEndDate && new Date(property.residenceEndDate) >= targetDate) {
      return false
    }
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
