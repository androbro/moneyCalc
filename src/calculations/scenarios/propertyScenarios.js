/**
 * Property-by-Property Scenario Analysis
 * 
 * Compare outcomes for individual property decisions (keep/sell/occupy).
 */

import { buildProjection } from '../projections/index.js'
import { getRemainingBalance, getAnnualLoanPayment } from '../loans/index.js'
import { calculateRentalIncomeTax, calculateETFTax } from '../taxes/index.js'
import { computePropertySaleProceeds } from './saleProceeds.js'
import { addYears } from '../utils/dateUtils.js'
import { isRentalActiveOn } from '../utils/propertyUtils.js'

/**
 * Build property-by-property scenario comparison
 * 
 * Allows per-property decisions:
 * - Keep (continue renting)
 * - Sell (and reinvest proceeds)
 * - Occupy (move in as primary residence)
 * 
 * @param {Array} properties - All portfolio properties
 * @param {Object} scenarioConfig - Configuration:
 *   - decisions: { [propertyId]: { action, saleYear, investmentType, investmentRate } }
 *   - taxConfig: Belgian tax configuration
 * @returns {Array} 20-year comparison with baseline and custom scenarios
 */
export function buildPropertyScenarioComparison(properties, scenarioConfig) {
  const { decisions = {}, taxConfig = {} } = scenarioConfig

  // Build baseline: all properties kept as-is
  const baseline = buildProjection(properties)

  // Track investments from sold properties
  const investments = {}

  const customPoints = []
  let cumulativeCF = 0

  for (let year = 0; year <= 20; year++) {
    const today = new Date()
    const yearStart = addYears(today, year)
    const yearEnd = addYears(today, year + 1)
    const targetDate = yearStart

    let totalPropertyValue = 0
    let totalLoanBalance = 0
    let totalAnnualIncome = 0
    let totalAnnualCosts = 0
    let investmentValue = 0
    let investmentTaxThisYear = 0

    // Process each property
    for (const property of properties) {
      const decision = decisions[property.id] || { action: 'keep' }
      const saleYear = decision.saleYear ?? 0

      // Check if property has been sold
      if (decision.action === 'sell' && year >= saleYear) {
        // Track investment if not already tracked
        if (!investments[property.id]) {
          const saleProceeds = computePropertySaleProceeds(
            property,
            saleYear,
            taxConfig,
            { brokeragePct: 0.03, prepaymentPct: 0.01 }
          )

          investments[property.id] = {
            principal: saleProceeds.netProceeds,
            saleYear,
            rate: decision.investmentRate ?? 0.07,
            dividendPct: taxConfig.etfDividendPct ?? 0
          }
        }

        // Calculate investment growth
        const inv = investments[property.id]
        const yearsInvested = year - inv.saleYear
        const currentInvValue = inv.principal * Math.pow(1 + inv.rate, yearsInvested)
        investmentValue += currentInvValue

        // Calculate ETF tax
        if (yearsInvested > 0) {
          investmentTaxThisYear += calculateETFTax(
            currentInvValue,
            inv.principal,
            inv.dividendPct
          )
        }

        continue // No property value for sold properties
      }

      // Property kept - calculate as normal
      const appRate = property.appreciationRate || 0.02
      const appreciated = property.currentValue * Math.pow(1 + appRate, year)
      totalPropertyValue += appreciated

      // Loan balance
      for (const loan of property.loans || []) {
        totalLoanBalance += getRemainingBalance(loan, targetDate.toISOString())
      }

      // Rental income (with tax if configured)
      // Use isRentalActiveOn to respect rentalStartDate/rentalEndDate, matching baseline behaviour
      if (decision.action === 'keep' && isRentalActiveOn(property, yearStart)) {
        const baseRent = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
        const indexRate = property.indexationRate ?? 0.02
        const vacancyRate = property.vacancyRate ?? 0.05
        const grossRent = baseRent * Math.pow(1 + indexRate, year)
        const effectiveRent = grossRent * (1 - vacancyRate)

        // Apply rental income tax
        const netRent = calculateRentalIncomeTax(effectiveRent, taxConfig)
        totalAnnualIncome += netRent
      }

      // Operating costs
      const inflRate = property.inflationRate ?? 0.02
      const maintenance = (property.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, year)
      const insurance = (property.annualInsuranceCost || 0) * Math.pow(1 + inflRate, year)
      const legacyMonthly = (property.monthlyExpenses || 0) * 12 * Math.pow(1 + inflRate, year)
      const propertyTax = property.annualPropertyTax || 0
      totalAnnualCosts += maintenance + insurance + legacyMonthly + propertyTax

      // Loan payments
      for (const loan of property.loans || []) {
        totalAnnualCosts += getAnnualLoanPayment(loan, year)
      }
    }

    // Add investment tax to costs
    totalAnnualCosts += investmentTaxThisYear

    const annualCashFlow = Math.round(totalAnnualIncome - totalAnnualCosts)
    cumulativeCF += annualCashFlow

    const netWorth = Math.round(totalPropertyValue + investmentValue - totalLoanBalance)
    const prevNetWorth = customPoints.length > 0 ? customPoints[customPoints.length - 1].netWorth : netWorth
    const equityGain = year === 0 ? 0 : netWorth - prevNetWorth

    customPoints.push({
      year,
      label: year === 0 ? 'Today' : `+${year}y`,
      propertyValue: Math.round(totalPropertyValue),
      investmentValue: Math.round(investmentValue),
      loanBalance: Math.round(totalLoanBalance),
      netWorth,
      equityGain,
      annualCashFlow,
      cumulativeCF: Math.round(cumulativeCF),
      totalReturn: Math.round(netWorth + cumulativeCF),
      investmentTax: Math.round(investmentTaxThisYear),
    })
  }

  // Combine baseline and custom
  return baseline.map((basePoint, idx) => ({
    year: basePoint.year,
    label: basePoint.label,
    baselineNetWorth: basePoint.netWorth,
    baselineCF: basePoint.cumulativeCF,
    customNetWorth: customPoints[idx].netWorth,
    customCF: customPoints[idx].cumulativeCF,
    delta: customPoints[idx].netWorth - basePoint.netWorth,
    deltaCF: customPoints[idx].cumulativeCF - basePoint.cumulativeCF,
    baseline: basePoint,
    custom: customPoints[idx],
  }))
}
