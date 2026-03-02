/**
 * Portfolio Projection Calculations
 * 
 * Build 20-year financial projections for property portfolios.
 */

import { getRemainingBalance, getAnnualLoanPayment } from '../loans/index.js'
import { isRentalActiveOn } from '../utils/propertyUtils.js'
import { addYears } from '../utils/dateUtils.js'

/**
 * Build 20-year projection for a portfolio of properties
 * 
 * Calculates year-by-year:
 * - Property value (with appreciation)
 * - Loan balances
 * - Rental income (indexed, with vacancy rate)
 * - Operating expenses (indexed)
 * - Cash flow
 * - Net worth
 * 
 * @param {Array} properties - Array of property objects
 * @returns {Array} Array of 21 data points (year 0-20)
 */
export function buildProjection(properties) {
  const today = new Date()
  const points = []
  let cumulativeCF = 0

  // Track cumulative value bumps per property from planned investments
  const valueBumps = {}
  for (const p of properties) {
    valueBumps[p.id] = 0
  }

  for (let year = 0; year <= 20; year++) {
    const yearStart = addYears(today, year)
    const yearEnd = addYears(today, year + 1)
    const targetDate = yearStart

    let totalPropertyValue = 0
    let totalLoanBalance = 0
    let totalAnnualIncome = 0
    let totalAnnualCosts = 0
    let plannedInvestCost = 0

    for (const property of properties) {
      const appRate = property.appreciationRate || 0.02

      // Apply any planned investments falling in this year window
      for (const inv of property.plannedInvestments || []) {
        const invDate = new Date(inv.plannedDate)
        if (invDate >= yearStart && invDate < yearEnd) {
          valueBumps[property.id] += inv.valueIncrease || 0
          plannedInvestCost += inv.cost || 0
        }
      }

      // Asset value: base appreciation + permanent value bumps
      const appreciated = property.currentValue * Math.pow(1 + appRate, year)
      totalPropertyValue += appreciated + valueBumps[property.id]

      // Loan balance
      for (const loan of property.loans || []) {
        totalLoanBalance += getRemainingBalance(loan, targetDate.toISOString())
      }

      // Indexed rental income (only if property is rented out)
      if (isRentalActiveOn(property, targetDate)) {
        const baseRent = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
        const indexRate = property.indexationRate ?? 0.02
        const vacancyRate = property.vacancyRate ?? 0.05
        const grossRent = baseRent * Math.pow(1 + indexRate, year)
        const effectiveRent = grossRent * (1 - vacancyRate)
        totalAnnualIncome += effectiveRent
      }

      // Indexed operating costs
      const inflRate = property.inflationRate ?? 0.02
      const maintenance = (property.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, year)
      const insurance = (property.annualInsuranceCost || 0) * Math.pow(1 + inflRate, year)
      const legacyMonthly = (property.monthlyExpenses || 0) * 12 * Math.pow(1 + inflRate, year)
      const propertyTax = property.annualPropertyTax || 0 // fixed, never indexed
      totalAnnualCosts += maintenance + insurance + legacyMonthly + propertyTax

      // Loan payments (actual cash out that year)
      for (const loan of property.loans || []) {
        totalAnnualCosts += getAnnualLoanPayment(loan, year)
      }
    }

    // Planned investment costs are one-off cash outflow
    const annualCashFlow = Math.round(totalAnnualIncome - totalAnnualCosts - plannedInvestCost)
    cumulativeCF += annualCashFlow

    const netWorth = Math.round(totalPropertyValue - totalLoanBalance)
    const prevNetWorth = points.length > 0 ? points[points.length - 1].netWorth : netWorth
    const equityGain = year === 0 ? 0 : netWorth - prevNetWorth

    points.push({
      year,
      label: year === 0 ? 'Today' : `+${year}y`,
      propertyValue: Math.round(totalPropertyValue),
      loanBalance: Math.round(totalLoanBalance),
      netWorth,
      equityGain,
      annualCashFlow,
      annualCosts: Math.round(totalAnnualCosts + plannedInvestCost),
      cumulativeCF: Math.round(cumulativeCF),
      plannedInvestCost: Math.round(plannedInvestCost),
      totalReturn: Math.round(netWorth + cumulativeCF),
    })
  }

  return points
}
