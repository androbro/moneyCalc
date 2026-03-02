/**
 * Future Property Simulator
 * 
 * Simulate impact of acquiring a new property in the future.
 */

import { buildProjection } from '../projections/index.js'
import { getRemainingBalance } from '../loans/index.js'
import { monthsBetween, addYears } from '../utils/dateUtils.js'

/**
 * Simulate adding a new property to portfolio
 * 
 * Builds two projections:
 * - Baseline: existing portfolio only
 * - With new property: existing + simulated property from acquisition year onward
 * 
 * @param {Array} existingProperties - Current portfolio
 * @param {Object} simulatedProperty - Future property to simulate:
 *   - purchasePrice: Acquisition price
 *   - renovationCost: One-off renovation cost
 *   - currentValue: Initial market value
 *   - appreciationRate: Annual appreciation
 *   - monthlyRentalIncome: Gross monthly rent
 *   - loanAmount: Mortgage amount
 *   - loanMonthlyPayment: Monthly payment
 *   - loanTermMonths: Loan term
 *   - acquisitionYear: Years from today to purchase
 * @returns {Object} { baseline, withNew, delta }
 */
export function simulateNewProperty(existingProperties, sim) {
  const baseline = buildProjection(existingProperties)

  const acquisitionYear = sim.acquisitionYear ?? 0
  const loanAmount = sim.loanAmount ?? 0
  const monthlyPayment = sim.loanMonthlyPayment ?? 0
  const termMonths = sim.loanTermMonths ?? 240
  const monthlyRate = (sim.loanInterestRate ?? 0.02) / 12

  const today = new Date()
  const acquisitionDate = addYears(today, acquisitionYear)

  // Create synthetic loan for getRemainingBalance
  const syntheticLoan = {
    originalAmount: loanAmount,
    interestRate: sim.loanInterestRate ?? 0.02,
    startDate: acquisitionDate.toISOString(),
    termMonths,
    monthlyPayment,
    amortizationSchedule: [],
  }

  let runningExtraCF = 0

  const withNew = baseline.map((basePoint, idx) => {
    const year = basePoint.year

    if (year < acquisitionYear) {
      return { ...basePoint }
    }

    const yearStart = addYears(today, year)
    const yearEnd = addYears(today, year + 1)

    // New property value
    const yearsOwned = year - acquisitionYear
    const newPropValue =
      (sim.currentValue || sim.purchasePrice || 0) *
      Math.pow(1 + (sim.appreciationRate || 0.02), yearsOwned)

    // Loan balance
    const targetDate = yearStart.toISOString()
    const newLoanBal = year === acquisitionYear
      ? loanAmount
      : getRemainingBalance(syntheticLoan, targetDate)

    // Rental income
    const baseRent = (sim.monthlyRentalIncome || 0) * 12
    const indexRate = sim.indexationRate ?? 0.02
    const newRent = baseRent * Math.pow(1 + indexRate, yearsOwned)

    // Operating costs
    const inflRate = sim.inflationRate ?? 0.02
    const newOpex =
      (sim.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, yearsOwned) +
      (sim.annualInsuranceCost || 0) * Math.pow(1 + inflRate, yearsOwned) +
      (sim.monthlyExpenses || 0) * 12 * Math.pow(1 + inflRate, yearsOwned) +
      (sim.annualPropertyTax || 0)

    // Loan payments
    let newLoanPayment = 0
    if (monthlyPayment > 0 && loanAmount > 0) {
      const acqMonths = monthsBetween(acquisitionDate, yearStart)
      const acqMonthsEnd = monthsBetween(acquisitionDate, yearEnd)
      const active = Math.max(0, Math.min(acqMonthsEnd, termMonths) - Math.max(0, acqMonths))
      newLoanPayment = active * monthlyPayment
    }

    // One-off costs in acquisition year
    const renovationCost = year === acquisitionYear ? (sim.renovationCost || 0) : 0
    const registrationTax = year === acquisitionYear ? (sim.registrationTax || 0) : 0

    // Cash flow from new property
    const addedCF = Math.round(newRent - newOpex - newLoanPayment - renovationCost - registrationTax)
    runningExtraCF += addedCF

    return {
      ...basePoint,
      propertyValue: basePoint.propertyValue + Math.round(newPropValue),
      loanBalance: basePoint.loanBalance + Math.round(newLoanBal),
      netWorth: basePoint.propertyValue + Math.round(newPropValue) - basePoint.loanBalance - Math.round(newLoanBal),
      annualCashFlow: basePoint.annualCashFlow + addedCF,
      cumulativeCF: Math.round(basePoint.cumulativeCF + runningExtraCF),
      totalReturn: Math.round(
        (basePoint.propertyValue + Math.round(newPropValue) - basePoint.loanBalance - Math.round(newLoanBal)) +
        (basePoint.cumulativeCF + runningExtraCF)
      ),
    }
  })

  const delta = baseline.map((basePt, i) => ({
    year: basePt.year,
    label: basePt.label,
    netWorth: withNew[i].netWorth - basePt.netWorth,
    annualCashFlow: withNew[i].annualCashFlow - basePt.annualCashFlow,
    cumulativeCF: withNew[i].cumulativeCF - basePt.cumulativeCF,
    totalReturn: withNew[i].totalReturn - basePt.totalReturn,
    propertyValue: withNew[i].propertyValue - basePt.propertyValue,
    loanBalance: withNew[i].loanBalance - basePt.loanBalance,
  }))

  return { baseline, withNew, delta }
}
