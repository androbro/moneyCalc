/**
 * Sale Proceeds Calculations
 * 
 * Calculate net proceeds from property sales including Belgian transaction costs.
 */

import { getRemainingBalance } from '../loans/index.js'
import { calculateCapitalGainsTax } from '../taxes/index.js'
import { addYears } from '../utils/dateUtils.js'

/**
 * Calculate net proceeds for selling entire portfolio
 * 
 * Belgian seller costs:
 * - Brokerage fee: typically 3%
 * - Prepayment penalty: capped at 3 months' interest (~0.75-1% of remaining balance)
 * - Capital gains tax: 16.5% if sold within 5 years
 * 
 * @param {Array} properties - Properties to sell
 * @param {number} saleYear - Years from today
 * @param {Object} config - Configuration:
 *   - brokeragePct: Brokerage fee (default 0.03)
 *   - prepaymentPct: Prepayment penalty (default 0.01)
 *   - registrationPct: Additional closing costs (default 0)
 * @returns {Object} Sale proceeds breakdown
 */
export function computeSaleProceeds(properties, saleYear, config = {}) {
  const {
    brokeragePct = 0.03,
    registrationPct = 0,
    prepaymentPct = 0.01,
  } = config

  const today = new Date()
  const saleDate = addYears(today, saleYear)
  const saleDateISO = saleDate.toISOString()

  let totalSaleValue = 0
  let totalLoanBalance = 0

  for (const property of properties) {
    const saleValue = property.currentValue * Math.pow(
      1 + (property.appreciationRate || 0.02),
      saleYear
    )
    totalSaleValue += saleValue

    for (const loan of property.loans || []) {
      totalLoanBalance += getRemainingBalance(loan, saleDateISO)
    }
  }

  const brokerage = totalSaleValue * brokeragePct
  const registration = totalSaleValue * registrationPct
  const prepaymentPenalty = totalLoanBalance * prepaymentPct

  const netProceeds = totalSaleValue - totalLoanBalance - brokerage - registration - prepaymentPenalty

  return {
    saleYear,
    totalSaleValue: Math.round(totalSaleValue),
    totalLoanBalance: Math.round(totalLoanBalance),
    brokerage: Math.round(brokerage),
    registration: Math.round(registration),
    prepaymentPenalty: Math.round(prepaymentPenalty),
    netProceeds: Math.round(netProceeds),
  }
}

/**
 * Calculate net proceeds for a single property sale with Belgian taxes
 * 
 * @param {Object} property - Property to sell
 * @param {number} saleYear - Years from today
 * @param {Object} taxConfig - Tax configuration
 * @param {Object} costConfig - Cost configuration
 * @returns {Object} Detailed sale breakdown
 */
export function computePropertySaleProceeds(property, saleYear, taxConfig = {}, costConfig = {}) {
  const today = new Date()
  const saleDate = addYears(today, saleYear)
  const saleDateISO = saleDate.toISOString()

  const brokeragePct = costConfig.brokeragePct ?? 0.03
  const prepaymentPct = costConfig.prepaymentPct ?? 0.01

  // Calculate appreciated value
  const saleValue = property.currentValue * Math.pow(
    1 + (property.appreciationRate || 0.02),
    saleYear
  )

  // Calculate remaining loan balance
  let totalLoanBalance = 0
  for (const loan of property.loans || []) {
    totalLoanBalance += getRemainingBalance(loan, saleDateISO)
  }

  // Transaction costs
  const brokerageFee = saleValue * brokeragePct
  const prepaymentPenalty = totalLoanBalance * prepaymentPct

  // Belgian capital gains tax
  const purchaseDate = new Date(property.purchaseDate)
  const capitalGainsResult = calculateCapitalGainsTax(
    property.purchasePrice || property.currentValue,
    saleValue,
    purchaseDate,
    saleDate,
    taxConfig
  )

  const netProceeds = saleValue - totalLoanBalance - brokerageFee - prepaymentPenalty - capitalGainsResult.tax

  return {
    grossValue: Math.round(saleValue),
    loanBalance: Math.round(totalLoanBalance),
    brokerageFee: Math.round(brokerageFee),
    prepaymentPenalty: Math.round(prepaymentPenalty),
    capitalGainsTax: capitalGainsResult.tax,
    netProceeds: Math.round(netProceeds),
    yearsSincePurchase: capitalGainsResult.yearsSincePurchase,
  }
}
