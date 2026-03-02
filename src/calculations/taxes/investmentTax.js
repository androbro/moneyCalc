/**
 * Belgian Investment Tax Calculations
 * 
 * Belgian tax treatment for investments:
 * - ETFs: 0% capital gains, 30% on dividends
 * - Bonds: Interest taxed at 30%
 * - Savings accounts: Interest taxed at 15% (first €1020 exempt in 2024)
 */

/**
 * Calculate Belgian ETF taxation
 * 
 * Belgian ETF tax rules:
 * - Capital gains: 0% tax (no taxation on price appreciation)
 * - Dividends: 30% withholding tax
 * 
 * For accumulating ETFs (reinvest dividends), dividendPct = 0 → no tax
 * For distributing ETFs, dividendPct = actual dividend yield
 * 
 * @param {number} currentValue - Current ETF value
 * @param {number} principal - Original investment amount
 * @param {number} dividendPct - Percentage of returns from dividends (0-1)
 * @returns {number} Annual tax owed on dividends
 */
export function calculateETFTax(currentValue, principal, dividendPct = 0) {
  const totalGain = Math.max(0, currentValue - principal)
  const dividendPortion = totalGain * dividendPct
  return Math.round(dividendPortion * 0.30)
}

/**
 * Calculate tax on bond interest
 * 
 * Belgian bonds: 30% withholding tax on interest
 * 
 * @param {number} interestIncome - Annual interest income
 * @returns {number} Tax amount
 */
export function calculateBondTax(interestIncome) {
  return Math.round(interestIncome * 0.30)
}

/**
 * Calculate tax on savings account interest
 * 
 * Belgian savings: 15% tax on interest above exemption threshold
 * Exemption: €1020 per person (2024)
 * 
 * @param {number} interestIncome - Annual interest income
 * @param {number} exemption - Tax-free amount (default 1020)
 * @returns {number} Tax amount
 */
export function calculateSavingsTax(interestIncome, exemption = 1020) {
  const taxableIncome = Math.max(0, interestIncome - exemption)
  return Math.round(taxableIncome * 0.15)
}
