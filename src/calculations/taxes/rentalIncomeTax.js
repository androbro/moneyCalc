/**
 * Belgian Rental Income Tax Calculations
 * 
 * Handles rental income taxation according to Belgian tax rules.
 * Two regimes:
 * 1. Withholding tax (30% simplified regime - roerende voorheffing)
 * 2. Personal declaration (marginal tax rate - varies by income bracket)
 */

/**
 * Calculate after-tax rental income using Belgian tax rules
 * 
 * @param {number} grossRent - Annual gross rental income
 * @param {Object} taxConfig - Tax configuration:
 *   - useWithholding: boolean - Use 30% withholding regime
 *   - rentalWithholding: number - Withholding rate (default 0.30)
 * @returns {number} Net rental income after tax
 */
export function calculateRentalIncomeTax(grossRent, taxConfig = {}) {
  if (!taxConfig.useWithholding) {
    // User declares in personal income tax
    // We don't apply withholding here (would need their marginal rate, which varies widely)
    return grossRent
  }
  
  const withholdingRate = taxConfig.rentalWithholding ?? 0.30
  return grossRent * (1 - withholdingRate)
}

/**
 * Calculate rental income based on indexed cadastral income (Kadastraal Inkomen)
 * 
 * In Belgium, rental income tax can be based on KI rather than actual rent.
 * KI is indexed by a factor (typically 1.4 for 2024).
 * 
 * @param {number} cadastralIncome - Base cadastral income (KI)
 * @param {number} indexFactor - Index factor (e.g., 1.4)
 * @param {number} marginalRate - Taxpayer's marginal rate
 * @returns {number} Annual tax amount
 */
export function calculateKIBasedTax(cadastralIncome, indexFactor = 1.4, marginalRate = 0.50) {
  const indexedKI = cadastralIncome * indexFactor
  return indexedKI * marginalRate
}
