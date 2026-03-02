/**
 * Calculations Module - Main Index
 * 
 * Central export point for all calculation functions.
 * Organized by domain following SOLID principles.
 */

// Loan calculations
export {
  calculateAnnuityRemainingBalance,
  getBalanceFromSchedule,
  getRemainingBalance,
  getAnnualLoanPayment,
  getLoanPaymentSplit
} from './loans/index.js'

// Tax calculations
export {
  calculateRentalIncomeTax,
  calculateKIBasedTax,
  calculateCapitalGainsTax,
  calculateETFTax,
  calculateBondTax,
  calculateSavingsTax,
  calculateRegistrationTax,
  calculateCoBuyingRegistrationTax
} from './taxes/index.js'

// Projections
export {
  buildProjection,
  computeSummary
} from './projections/index.js'

// Scenarios
export {
  computeSaleProceeds,
  computePropertySaleProceeds,
  buildScenarioComparison,
  buildPropertyScenarioComparison,
  simulateNewProperty
} from './scenarios/index.js'

// Utilities
export {
  monthsBetween,
  addYears,
  isDateInRange
} from './utils/dateUtils.js'

export {
  isRentalActiveOn,
  isPrimaryResidenceOn,
  getOwnershipShare
} from './utils/propertyUtils.js'

// Formatters
export {
  formatEUR,
  formatPct,
  formatCompact
} from './formatters/index.js'

// Legacy compatibility export
// Re-export monthsBetween as monthsBetweenPublic for backward compatibility
export { monthsBetween as monthsBetweenPublic } from './utils/dateUtils.js'
