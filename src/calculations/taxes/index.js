/**
 * Tax Calculations Module
 * 
 * Exports all Belgian tax-related calculation functions.
 */

export {
  calculateRentalIncomeTax,
  calculateKIBasedTax
} from './rentalIncomeTax.js'

export {
  calculateCapitalGainsTax
} from './capitalGainsTax.js'

export {
  calculateETFTax,
  calculateBondTax,
  calculateSavingsTax
} from './investmentTax.js'

export {
  calculateRegistrationTax,
  calculateCoBuyingRegistrationTax
} from './registrationTax.js'
