/**
 * Growth Roadmap Simulation Engine
 *
 * Simulates a multi-decade property snowball acquisition strategy month-by-month.
 * Each planned acquisition triggers when the user's accumulated cash is sufficient
 * to cover the required down payment + acquisition costs. Once acquired, the new
 * property's rental income accelerates the monthly savings snowball.
 *
 * @module growthRoadmap
 */

import { getRemainingBalance } from '../loans/loanBalance.js'
import { monthsBetween } from '../utils/dateUtils.js'

// ─── Loan calculation helpers ─────────────────────────────────────────────────

/**
 * Calculate annuity monthly payment.
 *
 * @param {number} principal   - Loan amount
 * @param {number} annualRate  - Annual interest rate (e.g. 0.035 for 3.5%)
 * @param {number} termMonths  - Loan term in months
 * @returns {number} Monthly payment
 */
export function calcMonthlyPayment(principal, annualRate, termMonths) {
  if (principal <= 0 || termMonths <= 0) return 0
  if (annualRate === 0) return principal / termMonths
  const r = annualRate / 12
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

/**
 * Calculate interest-only (bullet) monthly payment.
 *
 * @param {number} principal  - Loan amount
 * @param {number} annualRate - Annual interest rate
 * @returns {number} Monthly interest payment
 */
export function calcBulletMonthlyPayment(principal, annualRate) {
  if (principal <= 0) return 0
  return (principal * annualRate) / 12
}

// ─── Equity helpers ───────────────────────────────────────────────────────────

/**
 * Compute available equity from portfolio for refinancing/mandate.
 * Belgian formula: max(0, currentValue × 0.80 - remainingLoan)
 *
 * @param {Array}  properties    - Portfolio array
 * @param {string} targetDateISO - ISO date string
 * @returns {number} Total available equity across all properties
 */
export function computeAvailableEquity(properties, targetDateISO) {
  return properties.reduce((total, p) => {
    const val = p.currentValue || 0
    const debt = (p.loans || []).reduce((s, l) => {
      try {
        return s + getRemainingBalance(l, targetDateISO)
      } catch {
        return s + (l.originalAmount || 0)
      }
    }, 0)
    return total + Math.max(0, val * 0.80 - debt)
  }, 0)
}

/**
 * Compute monthly household surplus.
 *
 * @param {number} totalMemberIncome   - Sum of all member net incomes
 * @param {number} householdExpenses   - Monthly household expenses
 * @param {number} totalLoanPayments   - Sum of all monthly loan payments
 * @param {number} rentalNetCF         - Net rental cash flow (rent - property opex)
 * @returns {number} Monthly surplus
 */
export function computeMonthlySurplus(
  totalMemberIncome,
  householdExpenses,
  totalLoanPayments,
  rentalNetCF
) {
  return totalMemberIncome - householdExpenses - totalLoanPayments + rentalNetCF
}

// ─── Internal simulation helpers ─────────────────────────────────────────────

function addMonthsToDate(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Calculate remaining balance for a simulated loan (no schedule, formula only).
 *
 * @param {Object} simLoan       - { originalAmount, annualRate, termMonths, startDateISO, isBullet }
 * @param {Date}   targetDate
 * @returns {number}
 */
function simLoanBalance(simLoan, targetDate) {
  const paid = monthsBetween(new Date(simLoan.startDateISO), targetDate)
  if (paid <= 0) return simLoan.originalAmount
  if (simLoan.isBullet) {
    // Bullet loan: balance stays at original until maturity
    if (paid >= simLoan.termMonths) return 0
    return simLoan.originalAmount
  }
  // Annuity: use standard formula
  const r = simLoan.annualRate / 12
  const N = simLoan.termMonths
  const n = Math.min(paid, N)
  if (r === 0) return Math.max(0, simLoan.originalAmount * (1 - n / N))
  return Math.max(
    0,
    simLoan.originalAmount *
      (Math.pow(1 + r, N) - Math.pow(1 + r, n)) /
      (Math.pow(1 + r, N) - 1)
  )
}

/**
 * Determine recommended loan type for an acquisition.
 *
 * @param {Object} acq - PlannedAcquisition
 * @returns {string} Loan type id
 */
function selectRecommendedLoanType(acq) {
  if (acq.loanType && acq.loanType !== 'auto') return acq.loanType
  if (acq.isPrimaryResidence) return 'hypothecaire_lening'
  return 'hypothecaire_lening'
}

/**
 * Build a portfolio snapshot for milestone recording.
 */
function buildPortfolioSnapshot(simProps, accumulatedCash, monthIdx = 0) {
  const portfolioValue = simProps.reduce((s, p) => s + (p.simCurrentValue || 0), 0)
  const totalDebt = simProps.reduce(
    (s, p) =>
      s +
      (p.simLoans || []).reduce((ls, l) => {
        // Use stored balance if available (updated each month in loop)
        return ls + (l.simBalance || 0)
      }, 0),
    0
  )
  const rentalNetCF = simProps.reduce((s, p) => {
    if (!p.isRentedInSim) return s
    const indexRate = p.indexationRate ?? 0.02
    const indexedRent = (p.simMonthlyRent || 0) * Math.pow(1 + indexRate, monthIdx / 12)
    const vacancyRate = p.vacancyRate ?? 0.05
    const effectiveRent = indexedRent * (1 - vacancyRate)
    const inflRate = p.inflationRate ?? 0.02
    const indexedOpex = (p.simMonthlyExpenses || 0) * Math.pow(1 + inflRate, monthIdx / 12)
    // Subtract loan payments for this rental property — true after-mortgage cash flow
    const loanPayments = (p.simLoans || []).reduce((ls, l) => ls + (l.simMonthlyPayment || 0), 0)
    return s + effectiveRent - indexedOpex - loanPayments
  }, 0)
  return {
    portfolioValue: Math.round(portfolioValue),
    totalDebt: Math.round(totalDebt),
    netWorth: Math.round(portfolioValue - totalDebt),
    monthlyCashFlow: Math.round(rentalNetCF),
    accumulatedCash: Math.round(accumulatedCash),
    propertyCount: simProps.length,
  }
}

// ─── Main simulation ──────────────────────────────────────────────────────────

/**
 * Simulate a multi-decade property snowball acquisition strategy.
 *
 * @typedef {Object} PlannedAcquisition
 * @property {string}  label              - Human-readable name
 * @property {number}  targetPrice        - Full purchase price
 * @property {number}  [myShare=1]        - Ownership fraction [0–1]
 * @property {boolean} [isPrimaryResidence=false]
 * @property {number}  [monthlyRent=0]    - Gross monthly rent (0 if primary)
 * @property {number}  [monthlyExpenses=200] - Monthly opex
 * @property {number}  [appreciationRate=0.02]
 * @property {string}  [loanType='hypothecaire_lening']
 * @property {number}  [loanRate=0.035]   - Annual interest rate
 * @property {number}  [loanTermYears=20]
 * @property {number}  [acquisitionCostRate=0.14] - Registration + notary as fraction of price
 *
 * @typedef {Object} RoadmapConfig
 * @property {number}              [horizonYears=25]
 * @property {PlannedAcquisition[]} plannedAcquisitions
 * @property {number}              [maxLTV=0.80]
 * @property {number}              [startingCash=0]
 * @property {number}              [incomeSavingsBuffer=0.10]
 *
 * @param {Array}         properties  - Existing portfolio
 * @param {Object}        profile     - { members, householdExpenses }
 * @param {RoadmapConfig} config
 * @returns {{ milestones: Array, yearlyData: Array, summary: Object }}
 */
export function simulateGrowthRoadmap(properties, profile, config) {
  const {
    horizonYears = 25,
    plannedAcquisitions = [],
    maxLTV = 0.80,
    startingCash = 0,
    incomeSavingsBuffer = 0.10,
  } = config

  const today = new Date()
  const todayISO = today.toISOString()
  const horizonMonths = horizonYears * 12

  // ── Deep-copy existing portfolio and augment with sim fields ──
  const simProps = properties.map((p) => ({
    ...p,
    originalCurrentValue: p.currentValue || 0,
    simCurrentValue: p.currentValue || 0,
    isRentedInSim: p.status === 'rented' || p.isRented === true || (p.startRentalIncome || 0) > 0,
    simMonthlyRent: p.startRentalIncome || p.monthlyRentalIncome || 0,
    simMonthlyExpenses:
      ((p.annualMaintenanceCost || 0) +
        (p.annualInsuranceCost || 0) +
        (p.annualPropertyTax || 0)) /
        12 +
      (p.monthlyExpenses || 0),
    simLoans: (p.loans || []).map((l) => ({
      ...l,
      simBalance: (() => {
        try {
          return getRemainingBalance(l, todayISO)
        } catch {
          return l.originalAmount || 0
        }
      })(),
      isBullet: false, // existing loans are annuity
      annualRate: l.interestRate || 0,
      termMonths: l.termMonths || 240,
      startDateISO: l.startDate || todayISO,
      simMonthlyPayment: l.monthlyPayment || 0, // map real field name to sim field name
    })),
  }))

  // ── State ──
  let accumulatedCash = startingCash
  const pendingAcquisitions = plannedAcquisitions.map((a, i) => ({ ...a, _idx: i }))
  const milestones = []
  const yearlyData = []

  // ── Base income from household ──
  const totalMemberIncome = (profile.members || []).reduce(
    (s, m) => s + (m.netIncome || 0) + (m.investmentIncome || 0),
    0
  )
  const householdExpenses = profile.householdExpenses || 0

  // ── Month-by-month loop ──
  for (let monthIdx = 0; monthIdx <= horizonMonths; monthIdx++) {
    const currentDate = addMonthsToDate(today, monthIdx)
    const currentDateISO = currentDate.toISOString()

    // 1. Appreciate all properties
    for (const p of simProps) {
      const appRate = p.appreciationRate || 0.02
      p.simCurrentValue = p.originalCurrentValue * Math.pow(1 + appRate, monthIdx / 12)
    }

    // 2. Update loan balances for all simulated properties
    for (const p of simProps) {
      for (const l of p.simLoans) {
        l.simBalance = simLoanBalance(l, currentDate)
      }
    }

    // 3. Compute monthly surplus
    const totalLoanPayments = simProps.reduce(
      (s, p) => s + (p.simLoans || []).reduce((ls, l) => ls + (l.simMonthlyPayment || 0), 0),
      0
    )
    const rentalNetCF = simProps.reduce((s, p) => {
      if (!p.isRentedInSim) return s
      const indexRate = p.indexationRate ?? 0.02
      const indexedRent = p.simMonthlyRent * Math.pow(1 + indexRate, monthIdx / 12)
      const vacancyRate = p.vacancyRate ?? 0.05
      const effectiveRent = indexedRent * (1 - vacancyRate)
      const inflRate = p.inflationRate ?? 0.02
      const indexedOpex = p.simMonthlyExpenses * Math.pow(1 + inflRate, monthIdx / 12)
      return s + effectiveRent - indexedOpex
    }, 0)

    const surplus = computeMonthlySurplus(
      totalMemberIncome,
      householdExpenses,
      totalLoanPayments,
      rentalNetCF
    )
    const effectiveSurplus = Math.max(0, surplus * (1 - incomeSavingsBuffer))

    // 4. Accumulate cash (but not in month 0 before any check)
    if (monthIdx > 0) {
      accumulatedCash += effectiveSurplus
    }

    // 5. Check acquisition trigger for next planned acquisition
    if (pendingAcquisitions.length > 0) {
      const acq = pendingAcquisitions[0]
      const myShare = acq.myShare ?? 1.0
      const isPrimary = acq.isPrimaryResidence ?? false
      const targetPrice = acq.targetPrice || 0
      const costRate = acq.acquisitionCostRate ?? (isPrimary ? 0.04 : 0.14)
      const acquisitionCosts = targetPrice * costRate * myShare

      // Belgian banks: 90% LTV for primary, 80% for investment
      const ltvForAcq = isPrimary ? Math.min(0.90, maxLTV + 0.10) : maxLTV
      const maxBankLoan = targetPrice * ltvForAcq * myShare
      const myTotalCost = targetPrice * myShare + acquisitionCosts
      const requiredOwnFunds = Math.max(0, myTotalCost - maxBankLoan)

      if (accumulatedCash >= requiredOwnFunds) {
        const loanAmount = maxBankLoan
        const loanRate = acq.loanRate ?? 0.035
        const termMonths = (acq.loanTermYears ?? 20) * 12
        const isBullet =
          acq.loanType === 'bullet_loan' ||
          acq.loanType === 'ipt_bullet' ||
          acq.loanType === 'liquidatiereserve_bullet'

        const simMonthlyPayment = isBullet
          ? calcBulletMonthlyPayment(loanAmount, loanRate)
          : calcMonthlyPayment(loanAmount, loanRate, termMonths)

        // Deduct required own funds from cash
        accumulatedCash -= requiredOwnFunds

        // Add new property to sim portfolio
        const newProp = {
          id: `sim_acq_${milestones.length}`,
          name: acq.label,
          originalCurrentValue: targetPrice,
          simCurrentValue: targetPrice,
          appreciationRate: acq.appreciationRate ?? 0.02,
          isRentedInSim: !isPrimary && (acq.monthlyRent || 0) > 0,
          simMonthlyRent: acq.monthlyRent ?? 0,
          simMonthlyExpenses: acq.monthlyExpenses ?? 200,
          indexationRate: 0.02,
          vacancyRate: isPrimary ? 0 : 0.04,
          inflationRate: 0.02,
          simLoans: [
            {
              id: `sim_loan_${milestones.length}`,
              originalAmount: loanAmount,
              annualRate: loanRate,
              termMonths,
              startDateISO: currentDateISO,
              isBullet,
              simMonthlyPayment,
              simBalance: loanAmount,
            },
          ],
        }
        simProps.push(newProp)

        const snapshot = buildPortfolioSnapshot(simProps, accumulatedCash, monthIdx)
        const year = Math.floor(monthIdx / 12)
        const month = (monthIdx % 12) + 1

        milestones.push({
          monthIndex: monthIdx,
          year,
          month,
          type: 'acquisition',
          label: acq.label,
          propertyPrice: targetPrice,
          mySharePrice: Math.round(targetPrice * myShare),
          equityUsed: 0,
          cashUsed: Math.round(requiredOwnFunds),
          newLoanAmount: Math.round(loanAmount),
          acquisitionCosts: Math.round(acquisitionCosts),
          monthlyPayment: Math.round(simMonthlyPayment),
          isBullet,
          recommendedLoanType: selectRecommendedLoanType(acq),
          portfolioSnapshot: snapshot,
        })

        pendingAcquisitions.shift()
      }
    }

    // 6. Capture yearly snapshot
    if (monthIdx % 12 === 0) {
      const year = monthIdx / 12
      const snapshot = buildPortfolioSnapshot(simProps, accumulatedCash, monthIdx)
      yearlyData.push({
        year,
        label: year === 0 ? 'Today' : `+${year}y`,
        portfolioValue: snapshot.portfolioValue,
        totalDebt: snapshot.totalDebt,
        netWorth: snapshot.netWorth,
        monthlyCashFlow: snapshot.monthlyCashFlow,
        monthlySurplus: Math.round(effectiveSurplus),
        accumulatedCash: snapshot.accumulatedCash,
        acquisitionsToDate: milestones.length,
      })
    }
  }

  // ── Summary ──
  const lastYear = yearlyData[yearlyData.length - 1] ?? {
    netWorth: 0,
    monthlyCashFlow: 0,
    monthlySurplus: 0,
  }
  const firstMilestone = milestones[0] ?? null

  return {
    milestones,
    yearlyData,
    summary: {
      readyInMonths: firstMilestone ? firstMilestone.monthIndex : null,
      totalProperties: simProps.length,
      finalNetWorth: lastYear.netWorth,
      finalMonthlyCF: lastYear.monthlyCashFlow,
      finalMonthlySurplus: lastYear.monthlySurplus,
    },
  }
}
