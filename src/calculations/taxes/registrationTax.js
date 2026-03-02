/**
 * Belgian Registration Tax Calculations (Registratierechten)
 * 
 * Belgian property purchase taxes:
 * - Standard rate: 12% (Flanders), 12.5% (Brussels), 12.5% (Wallonia)
 * - Reduced rate: 2% (Flanders) for "enige eigen woning" (sole primary residence)
 * - Conditions for reduced rate vary by region
 */

/**
 * Calculate Belgian registration tax for property purchase
 * 
 * @param {number} purchasePrice - Property purchase price
 * @param {Object} config - Configuration:
 *   - standardRate: number - Standard rate (default 0.12 for Flanders)
 *   - reducedRate: number - Reduced rate (default 0.02)
 *   - qualifiesForReduction: boolean - Whether buyer qualifies for reduced rate
 * @returns {Object} { tax, rate, qualifiesForReduction }
 */
export function calculateRegistrationTax(purchasePrice, config = {}) {
  const standardRate = config.standardRate ?? 0.12
  const reducedRate = config.reducedRate ?? 0.02
  const qualifiesForReduction = config.qualifiesForReduction ?? false
  
  const rate = qualifiesForReduction ? reducedRate : standardRate
  const tax = purchasePrice * rate
  
  return {
    tax: Math.round(tax),
    rate,
    qualifiesForReduction
  }
}

/**
 * Calculate registration tax for co-buying scenario
 * 
 * When buying with multiple owners, each owner's share can be taxed at different rates
 * (e.g., one owner qualifies for reduced rate, the other doesn't).
 * 
 * @param {number} purchasePrice - Total property purchase price
 * @param {Array} owners - Array of owner objects:
 *   - share: number - Ownership percentage (0-1)
 *   - qualifiesForReduction: boolean - Whether this owner qualifies for reduced rate
 * @param {Object} config - Tax rates configuration
 * @returns {Object} { totalTax, ownerBreakdown }
 */
export function calculateCoBuyingRegistrationTax(purchasePrice, owners, config = {}) {
  const standardRate = config.standardRate ?? 0.12
  const reducedRate = config.reducedRate ?? 0.02
  
  const ownerBreakdown = owners.map(owner => {
    const ownerSharePrice = purchasePrice * owner.share
    const rate = owner.qualifiesForReduction ? reducedRate : standardRate
    const tax = ownerSharePrice * rate
    
    return {
      share: owner.share,
      sharePrice: Math.round(ownerSharePrice),
      rate,
      tax: Math.round(tax),
      qualifiesForReduction: owner.qualifiesForReduction
    }
  })
  
  const totalTax = ownerBreakdown.reduce((sum, o) => sum + o.tax, 0)
  
  return {
    totalTax: Math.round(totalTax),
    ownerBreakdown
  }
}
