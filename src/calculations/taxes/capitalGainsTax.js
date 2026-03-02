/**
 * Belgian Capital Gains Tax Calculations
 * 
 * Belgian speculation tax (speculatiebelasting):
 * - 16.5% tax on capital gains if property sold within 5 years of purchase
 * - Exemptions exist for primary residences
 */

/**
 * Calculate Belgian capital gains tax on property sale
 * 
 * Belgian "speculation tax" applies at 16.5% if:
 * - Property sold within 5 years of purchase
 * - Not a primary residence (enige eigen woning)
 * 
 * @param {number} purchasePrice - Original purchase price
 * @param {number} saleValue - Sale value
 * @param {Date} purchaseDate - Original purchase date
 * @param {Date} saleDate - Sale date
 * @param {Object} config - Configuration:
 *   - capitalGainsRate: number - Tax rate (default 0.165)
 *   - capitalGainsApplies: boolean - Whether tax applies (default true)
 * @returns {Object} { capitalGain, tax, taxApplies, yearsSincePurchase }
 */
export function calculateCapitalGainsTax(
  purchasePrice,
  saleValue,
  purchaseDate,
  saleDate,
  config = {}
) {
  const capitalGain = Math.max(0, saleValue - purchasePrice)
  
  // Calculate years since purchase
  const yearsSincePurchase =
    (saleDate.getFullYear() - purchaseDate.getFullYear()) +
    (saleDate.getMonth() - purchaseDate.getMonth()) / 12
  
  // Tax applies if sold within 5 years
  const taxApplies = yearsSincePurchase < 5 && config.capitalGainsApplies !== false
  
  const tax = taxApplies
    ? capitalGain * (config.capitalGainsRate ?? 0.165)
    : 0
  
  return {
    capitalGain: Math.round(capitalGain),
    tax: Math.round(tax),
    taxApplies,
    yearsSincePurchase: Math.round(yearsSincePurchase * 10) / 10
  }
}
