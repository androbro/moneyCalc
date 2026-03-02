/**
 * projectionUtils.js
 *
 * Pure calculation helpers for net-worth projection, cash-flow simulation,
 * and scenario analysis (sell vs. hold).
 */

// ─── Loan balance ─────────────────────────────────────────────────────────────

/**
 * Given an amortization schedule and a target date, return the remaining
 * loan balance. Falls back to the annuity formula if no schedule is loaded.
 */
export function getRemainingBalance(loan, targetDate) {
  const { amortizationSchedule = [], originalAmount, interestRate, termMonths, startDate } = loan

  if (amortizationSchedule.length > 0) {
    const target = new Date(targetDate)
    const past = amortizationSchedule
      .filter((e) => new Date(e.dueDate) <= target)
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))

    if (past.length > 0) return Math.max(0, past[0].remainingBalance)
    return originalAmount // before first payment
  }

  return annuityRemainingBalance(
    originalAmount,
    interestRate / 12,
    termMonths,
    monthsBetween(new Date(startDate), new Date(targetDate))
  )
}

/**
 * Annual loan payments in a given year range, used for cash-flow projection.
 * Returns total capital + interest paid across all months that fall in `year`
 * relative to today.
 */
export function getAnnualLoanPayment(loan, year) {
  const today = new Date()
  const yearStart = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())
  const yearEnd   = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())

  const { amortizationSchedule = [], monthlyPayment, termMonths, startDate } = loan

  if (amortizationSchedule.length > 0) {
    return amortizationSchedule
      .filter((e) => {
        const d = new Date(e.dueDate)
        return d >= yearStart && d < yearEnd
      })
      .reduce((sum, e) => sum + e.totalPayment, 0)
  }

  // Fallback: count active months in this year window
  const start = new Date(startDate)
  const endMonth = monthsBetween(start, new Date(start.getFullYear() + Math.ceil(termMonths / 12), start.getMonth(), start.getDate()))
  const windowStart = monthsBetween(start, yearStart)
  const windowEnd   = monthsBetween(start, yearEnd)
  const activeMonths = Math.max(0, Math.min(windowEnd, termMonths) - Math.max(0, windowStart))
  return activeMonths * (monthlyPayment || 0)
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function annuityRemainingBalance(principal, monthlyRate, totalMonths, paidMonths) {
  if (monthlyRate === 0) return Math.max(0, principal * (1 - paidMonths / totalMonths))
  if (paidMonths >= totalMonths) return 0
  const r = monthlyRate
  const N = totalMonths
  const n = Math.max(0, paidMonths)
  return Math.max(0, principal * (Math.pow(1 + r, N) - Math.pow(1 + r, n)) / (Math.pow(1 + r, N) - 1))
}

function monthsBetween(dateA, dateB) {
  return (dateB.getFullYear() - dateA.getFullYear()) * 12 + (dateB.getMonth() - dateA.getMonth())
}

// ─── Main projection ──────────────────────────────────────────────────────────

/**
 * Build the full 20-year projection dataset.
 *
 * Each data point includes:
 *   propertyValue   – total appreciated portfolio value
 *   loanBalance     – total outstanding debt
 *   netWorth        – propertyValue - loanBalance
 *   annualCashFlow  – indexed rent - indexed costs - loan payments (that year)
 *   cumulativeCF    – running total of annualCashFlow
 *
 * New property fields consumed:
 *   indexationRate         – annual rent increase (e.g. 0.02)
 *   annualMaintenanceCost  – maintenance per year (indexed by inflationRate)
 *   annualInsuranceCost    – insurance per year (indexed by inflationRate)
 *   inflationRate          – cost inflation rate (e.g. 0.02)
 *
 * Legacy fields still supported:
 *   monthlyRentalIncome  → used if no startRentalIncome set
 *   monthlyExpenses      → still used as a catch-all
 */
export function buildProjection(properties) {
  const today = new Date()
  const points = []
  let cumulativeCF = 0

  // Track cumulative value bumps per property from planned investments
  // as we sweep year by year (bumps are permanent once applied)
  const valueBumps = {}          // propertyId → running sum of value increases applied so far
  for (const p of properties) valueBumps[p.id] = 0

  for (let year = 0; year <= 20; year++) {
    const yearStart = new Date(today.getFullYear() + year,     today.getMonth(), today.getDate())
    const yearEnd   = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())
    const targetDate = yearStart

    let totalPropertyValue   = 0
    let totalLoanBalance     = 0
    let totalAnnualIncome    = 0   // indexed rental income
    let totalAnnualCosts     = 0   // indexed opex + loan payments
    let plannedInvestCost    = 0   // one-off cash outlays this year

    for (const property of properties) {
      const appRate = property.appreciationRate || 0.02

      // ── Apply any planned investments falling in this year window ──
      for (const inv of property.plannedInvestments || []) {
        const invDate = new Date(inv.plannedDate)
        if (invDate >= yearStart && invDate < yearEnd) {
          valueBumps[property.id]  += inv.valueIncrease || 0
          plannedInvestCost        += inv.cost || 0
        }
      }

      // ── Asset value: base appreciation + permanent value bumps ──
      const appreciated = property.currentValue * Math.pow(1 + appRate, year)
      // Each bump was added at a certain year; approximate by growing the accumulated
      // bump from year 0 (conservative — treats bump as if it happened at year 0).
      // More precise: sum bump_i * (1+r)^(year - bump_year_i), but per-bump tracking
      // adds complexity. Simple additive approach is used here.
      totalPropertyValue += appreciated + valueBumps[property.id]

      // ── Loan balance ──
      for (const loan of property.loans || []) {
        totalLoanBalance += getRemainingBalance(loan, targetDate.toISOString())
      }

      // ── Indexed rental income (only if property is rented out) ──
      if (property.isRented !== false) {
        const baseRent   = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
        const indexRate  = property.indexationRate ?? 0.02
        const vacancyRate = property.vacancyRate ?? 0.05
        // Apply vacancy rate: effectiveRent = grossRent × (1 - vacancyRate)
        const grossRent = baseRent * Math.pow(1 + indexRate, year)
        const effectiveRent = grossRent * (1 - vacancyRate)
        totalAnnualIncome += effectiveRent
      }

      // ── Indexed operating costs ──
      const inflRate      = property.inflationRate ?? 0.02
      const maintenance   = (property.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, year)
      const insurance     = (property.annualInsuranceCost   || 0) * Math.pow(1 + inflRate, year)
      const legacyMonthly = (property.monthlyExpenses       || 0) * 12 * Math.pow(1 + inflRate, year)
      const propertyTax   = property.annualPropertyTax || 0   // fixed, never indexed
      totalAnnualCosts += maintenance + insurance + legacyMonthly + propertyTax

      // ── Loan payments (actual cash out that year) ──
      for (const loan of property.loans || []) {
        totalAnnualCosts += getAnnualLoanPayment(loan, year)
      }
    }

    // Planned investment costs are a one-off cash outflow (reduce cash flow that year)
    const annualCashFlow = Math.round(totalAnnualIncome - totalAnnualCosts - plannedInvestCost)
    cumulativeCF += annualCashFlow

    const netWorth    = Math.round(totalPropertyValue - totalLoanBalance)
    const prevNetWorth = points.length > 0 ? points[points.length - 1].netWorth : netWorth
    const equityGain  = year === 0 ? 0 : netWorth - prevNetWorth

    points.push({
      year,
      label: year === 0 ? 'Today' : `+${year}y`,
      propertyValue:       Math.round(totalPropertyValue),
      loanBalance:         Math.round(totalLoanBalance),
      netWorth,
      equityGain,                               // year-on-year equity increase
      annualCashFlow,
      annualCosts:         Math.round(totalAnnualCosts + plannedInvestCost),
      cumulativeCF:        Math.round(cumulativeCF),
      plannedInvestCost:   Math.round(plannedInvestCost),
      // Total return: equity position + all cash collected/spent so far
      totalReturn:         Math.round(netWorth + cumulativeCF),
    })
  }

  return points
}

// ─── Rental date awareness ────────────────────────────────────────────────────

/**
 * Returns true if rental income is active for this property on `date`.
 * Mirrors the logic in PropertyForm.jsx (isRentalActive) but kept here
 * so projectionUtils has no component import dependency.
 */
export function isRentalActiveOn(property, date = new Date()) {
  if (property.status && property.status !== 'rented') return false
  // Legacy: if no status field, fall back to isRented boolean
  if (!property.status && property.isRented === false) return false
  if (property.rentalStartDate && new Date(property.rentalStartDate) > date) return false
  if (property.rentalEndDate   && new Date(property.rentalEndDate)   < date) return false
  return true
}

// ─── Loan interest / capital split ───────────────────────────────────────────

/**
 * For a given loan, return the approximate monthly interest and capital
 * repayment components as of today.
 *
 * If an amortization schedule is present, find the row closest to today.
 * Otherwise derive from the annuity formula.
 *
 * Returns { monthlyInterest, monthlyCapital, monthlyTotal }
 */
export function getLoanPaymentSplit(loan, date = new Date()) {
  const { amortizationSchedule = [], originalAmount, interestRate,
          termMonths, startDate, monthlyPayment } = loan
  const totalPayment = monthlyPayment || 0

  if (amortizationSchedule.length > 0) {
    // Find the schedule row whose dueDate is closest to (but not after) today
    const today = date
    const past = amortizationSchedule
      .filter((e) => new Date(e.dueDate) <= today)
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
    if (past.length > 0) {
      return {
        monthlyInterest: past[0].interest || 0,
        monthlyCapital:  past[0].capitalRepayment || 0,
        monthlyTotal:    past[0].totalPayment || totalPayment,
      }
    }
    // Before first payment — estimate from original balance
  }

  // Annuity formula estimate
  if (!originalAmount || !interestRate || !startDate) {
    return { monthlyInterest: 0, monthlyCapital: totalPayment, monthlyTotal: totalPayment }
  }
  const balance = getRemainingBalance(loan, date.toISOString())
  const monthlyRate = interestRate / 12
  const interest = balance * monthlyRate
  const capital  = Math.max(0, totalPayment - interest)
  return { monthlyInterest: interest, monthlyCapital: capital, monthlyTotal: totalPayment }
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

/**
 * Compute current snapshot for KPI cards.
 *
 * Rental income is only counted if rental is currently active (respects
 * rentalStartDate / rentalEndDate / status fields).
 *
 * Loan payments are split:
 *   - interest component → true cost (counted in annualCosts)
 *   - capital component  → equity building (NOT counted in cash-flow cost)
 *
 * Personal net worth uses each property's `owners` array to find the share
 * owned by "me" (owner.name === 'Me' or first owner if none is flagged).
 * Pass `profile` (householdProfile) to also include personal cash & investments.
 *
 * Fields returned:
 *   totalPortfolioValue, totalDebt, totalNetWorth  – full portfolio (all owners)
 *   personalRealEstateNetWorth                     – my share of equity only
 *   personalCash                                   – my cash (isMe member)
 *   personalInvestmentValue                        – my investment positions (today value, contributions only)
 *   personalNetWorth                               – sum of all three above
 *   totalMonthlyCashFlow, annualNetCashFlow
 *   monthlyInterest, monthlyCapital  – aggregate loan split
 *   roe, propertyCount, loanCount
 *   activeRentalCount
 */
export function computeSummary(properties, profile = null) {
  let totalAssets      = 0
  let totalLiabilities = 0
  let personalAssets   = 0   // my share of property values
  let personalDebt     = 0   // my share of loan balances
  let annualRentalIncome = 0
  let annualOpex       = 0
  let annualInterest   = 0
  let annualCapital    = 0
  let activeRentalCount = 0

  const today    = new Date()
  const todayISO = today.toISOString()

  // Planned/simulated properties are excluded from live dashboard metrics.
  // They appear in projections only (projectPortfolio handles them separately).
  const liveProperties = properties.filter((p) => p.status !== 'planned')

  for (const property of liveProperties) {
    const value = property.currentValue || 0
    totalAssets += value

    // My ownership share on this property (default 100% if no owners array)
    const owners   = property.owners || [{ name: 'Me', share: 1 }]
    const myOwner  = owners.find((o) => /^me$/i.test(o.name?.trim())) ?? owners[0]
    const myShare  = Number(myOwner?.share ?? 1)
    personalAssets += value * myShare

    if (isRentalActiveOn(property, today)) {
      const grossRent = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
      const vacancyRate = property.vacancyRate ?? 0.05
      // Apply vacancy rate: effectiveRent = grossRent × (1 - vacancyRate)
      annualRentalIncome += grossRent * (1 - vacancyRate)
      activeRentalCount++
    }

    annualOpex += (property.annualMaintenanceCost || 0)
    annualOpex += (property.annualInsuranceCost || 0)
    annualOpex += (property.monthlyExpenses || 0) * 12
    annualOpex += (property.annualPropertyTax || 0)

    for (const loan of property.loans || []) {
      const balance = getRemainingBalance(loan, todayISO)
      totalLiabilities += balance
      personalDebt     += balance * myShare
      const split = getLoanPaymentSplit(loan, today)
      annualInterest += split.monthlyInterest * 12
      annualCapital  += split.monthlyCapital  * 12
    }
  }

  const equity = totalAssets - totalLiabilities
  const personalRealEstateNetWorth = personalAssets - personalDebt

  // Personal cash & investments from the "isMe" household member
  let personalCash            = 0
  let personalInvestmentValue = 0  // simple sum of cash contributed to positions (not compounded — for snapshot)
  if (profile?.members) {
    const me = profile.members.find((m) => m.isMe) ?? profile.members[0]
    if (me) {
      personalCash = me.cash || 0
      // Investment value = sum of monthly amounts × 12 months contributed so far
      // We don't have a "since date" so we use monthly × 12 as a simple 1-year proxy for display
      // The real compounded value lives in the projection chart
      personalInvestmentValue = (me.investmentPositions || [])
        .reduce((s, p) => s + (p.monthlyAmount || 0) * 12, 0)
    }
  }

  const personalNetWorth = personalRealEstateNetWorth + personalCash

  const annualNetCF = annualRentalIncome - annualOpex - annualInterest
  const roe = equity > 0 ? (annualNetCF / equity) * 100 : 0

  return {
    // Full portfolio totals
    totalAssets,
    totalPortfolioValue:          totalAssets,
    totalLiabilities,
    totalDebt:                    totalLiabilities,
    totalNetWorth:                equity,
    // Personal breakdown
    personalRealEstateNetWorth,
    personalCash,
    personalInvestmentValue,
    personalNetWorth,
    // Cash flow
    totalMonthlyCashFlow:         annualNetCF / 12,
    annualNetCashFlow:            annualNetCF,
    monthlyInterest:              annualInterest / 12,
    monthlyCapital:               annualCapital  / 12,
    annualRentalIncome,
    annualOpex,
    annualInterest,
    annualCapital,
    roe,
    propertyCount:                liveProperties.length,
    loanCount:                    liveProperties.reduce((sum, p) => sum + (p.loans?.length || 0), 0),
    activeRentalCount,
  }
}

// ─── Scenario analysis ────────────────────────────────────────────────────────

/**
 * Calculate net sale proceeds in a given year.
 *
 * saleYear        – years from today
 * brokeragePct    – agent commission as decimal (e.g. 0.03)
 * registrationPct – Additional seller-side closing costs as decimal (default 0).
 *                   Note: in Belgium the BUYER pays registration tax, not the seller.
 *                   Only include if you have specific additional costs on the seller side.
 * prepaymentPct   – bank prepayment penalty (wederbeleggingsvergoeding) as decimal of remaining
 *                   balance. Belgian law caps this at 3 months' interest; as % of balance
 *                   this is typically 0.5–1.5% depending on rate and remaining term (e.g. 0.01).
 */
export function computeSaleProceeds(properties, saleYear, {
  brokeragePct    = 0.03,
  registrationPct = 0,
  prepaymentPct   = 0.01,  // Belgian law caps wederbeleggingsvergoeding at 3 months' interest;
                            // at typical rates (3–4%) this equals ~0.75–1% of remaining balance.
} = {}) {
  const today = new Date()
  const saleDate = new Date(today.getFullYear() + saleYear, today.getMonth(), today.getDate())
  const saleDateISO = saleDate.toISOString()

  let totalSaleValue   = 0
  let totalLoanBalance = 0

  for (const property of properties) {
    const saleValue = property.currentValue * Math.pow(1 + (property.appreciationRate || 0.02), saleYear)
    totalSaleValue += saleValue

    for (const loan of property.loans || []) {
      totalLoanBalance += getRemainingBalance(loan, saleDateISO)
    }
  }

  const brokerage       = totalSaleValue * brokeragePct
  const registration    = totalSaleValue * registrationPct
  const prepaymentPenalty = totalLoanBalance * prepaymentPct

  const netProceeds = totalSaleValue - totalLoanBalance - brokerage - registration - prepaymentPenalty

  return {
    saleYear,
    totalSaleValue:     Math.round(totalSaleValue),
    totalLoanBalance:   Math.round(totalLoanBalance),
    brokerage:          Math.round(brokerage),
    registration:       Math.round(registration),
    prepaymentPenalty:  Math.round(prepaymentPenalty),
    netProceeds:        Math.round(netProceeds),
  }
}

/**
 * Build the Sell-vs-Hold comparison dataset.
 *
 * "Hold" value at year Y  = netWorth from buildProjection (Y)
 * "Sell at X, Reinvest" Y = netProceeds at X, compounded at reinvestRate for (Y - X) years
 *                           If Y < X → same as hold (haven't sold yet)
 */
export function buildScenarioComparison(properties, saleYear, {
  reinvestRate    = 0.05,
  brokeragePct    = 0.03,
  registrationPct = 0,
  prepaymentPct   = 0.01,  // Belgian cap: 3 months' interest ≈ 0.75–1% of remaining balance
} = {}) {
  const projection = buildProjection(properties)
  const sale = computeSaleProceeds(properties, saleYear, { brokeragePct, registrationPct, prepaymentPct })
  const netProceeds = sale.netProceeds

  return projection.map((point) => {
    const holdValue = point.netWorth

    let sellValue
    if (point.year < saleYear) {
      sellValue = holdValue // haven't sold yet — same position
    } else {
      // Proceeds compounded at reinvest rate
      sellValue = Math.round(netProceeds * Math.pow(1 + reinvestRate, point.year - saleYear))
    }

    return {
      ...point,
      holdValue,
      sellValue,
    }
  })
}

// ─── Future Property Simulator ────────────────────────────────────────────────

/**
 * simulateNewProperty(existingProperties, simulatedProperty, householdProfile)
 *
 * Builds two 20-year projection series:
 *   "baseline"  – existing portfolio as-is
 *   "withNew"   – existing portfolio + the simulated future property
 *
 * Each series has the same shape as buildProjection() output.
 *
 * The simulated property is injected from `acquisitionYear` (years from today)
 * onward.  Before that year every withNew data point equals the baseline.
 *
 * simulatedProperty shape:
 * {
 *   purchasePrice        – acquisition price
 *   renovationCost       – one-off upfront cost in the acquisition year
 *   currentValue         – initial market value (often = purchasePrice)
 *   appreciationRate     – decimal (e.g. 0.03)
 *   monthlyRentalIncome  – gross monthly rent from acquisition year onward
 *   indexationRate       – rent index rate
 *   annualMaintenanceCost
 *   annualInsuranceCost
 *   annualPropertyTax
 *   monthlyExpenses      – catch-all operating costs
 *   inflationRate
 *   loanAmount           – mortgage taken to buy
 *   loanMonthlyPayment   – monthly repayment
 *   loanTermMonths       – total loan term
 *   acquisitionYear      – years from today when the purchase happens (e.g. 2)
 * }
 *
 * Returns: { baseline: ProjectionPoint[], withNew: ProjectionPoint[], delta: ProjectionPoint[] }
 *   delta = withNew − baseline for key fields (useful for a "impact" chart)
 */
export function simulateNewProperty(existingProperties, sim) {
  const baseline = buildProjection(existingProperties)

  const acquisitionYear = sim.acquisitionYear ?? 0
  const loanAmount      = sim.loanAmount ?? 0
  const monthlyPayment  = sim.loanMonthlyPayment ?? 0
  const termMonths      = sim.loanTermMonths ?? 240
  const monthlyRate     = (sim.loanInterestRate ?? 0.02) / 12

  // ── Build a synthetic loan object so we can reuse getRemainingBalance ──
  const today = new Date()
  const acquisitionDate = new Date(
    today.getFullYear() + acquisitionYear,
    today.getMonth(),
    today.getDate()
  )

  const syntheticLoan = {
    originalAmount: loanAmount,
    interestRate:   sim.loanInterestRate ?? 0.02,
    startDate:      acquisitionDate.toISOString(),
    termMonths,
    monthlyPayment,
    amortizationSchedule: [],
  }

  let cumulativeCFWithNew = 0

  const withNew = baseline.map((basePoint, idx) => {
    const year = basePoint.year

    if (year < acquisitionYear) {
      // Before purchase: everything matches baseline, but track CF separately
      cumulativeCFWithNew += (idx === 0 ? 0 : basePoint.annualCashFlow -
        (idx > 0 ? baseline[idx - 1].annualCashFlow : 0) - basePoint.annualCashFlow +
        basePoint.annualCashFlow)
      // Simpler: just sync up to baseline for years before acquisition
      return { ...basePoint, cumulativeCF: basePoint.cumulativeCF, totalReturn: basePoint.totalReturn }
    }

    const yearStart = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())
    const yearEnd   = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())

    // ── New property value ──
    const yearsOwned = year - acquisitionYear
    const newPropValue =
      (sim.currentValue || sim.purchasePrice || 0) *
      Math.pow(1 + (sim.appreciationRate || 0.02), yearsOwned)

    // ── Loan balance on the new property ──
    const targetDate = yearStart.toISOString()
    const newLoanBal = year === acquisitionYear
      ? loanAmount
      : getRemainingBalance(syntheticLoan, targetDate)

    // ── Rental income from new property ──
    const baseRent   = (sim.monthlyRentalIncome || 0) * 12
    const indexRate  = sim.indexationRate ?? 0.02
    const newRent    = baseRent * Math.pow(1 + indexRate, yearsOwned)

    // ── Operating costs ──
    const inflRate   = sim.inflationRate ?? 0.02
    const newOpex =
      (sim.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, yearsOwned) +
      (sim.annualInsuranceCost   || 0) * Math.pow(1 + inflRate, yearsOwned) +
      (sim.monthlyExpenses       || 0) * 12 * Math.pow(1 + inflRate, yearsOwned) +
      (sim.annualPropertyTax     || 0)

    // ── Loan payments (new property) ──
    let newLoanPayment = 0
    if (monthlyPayment > 0 && loanAmount > 0) {
      // count active months in this year window
      const acqMonths    = monthsBetweenPublic(acquisitionDate, yearStart)
      const acqMonthsEnd = monthsBetweenPublic(acquisitionDate, yearEnd)
      const active = Math.max(0, Math.min(acqMonthsEnd, termMonths) - Math.max(0, acqMonths))
      newLoanPayment = active * monthlyPayment
    }

    // Renovation cost is a one-off hit in the acquisition year
    const renovationCost = year === acquisitionYear ? (sim.renovationCost || 0) : 0

    // Registration tax is a one-off upfront cost in the acquisition year
    const registrationTax = year === acquisitionYear ? (sim.registrationTax || 0) : 0

    // ── Combine with baseline ──
    const addedCF = Math.round(newRent - newOpex - newLoanPayment - renovationCost - registrationTax)

    const combinedPropValue  = basePoint.propertyValue + Math.round(newPropValue)
    const combinedLoanBal    = basePoint.loanBalance   + Math.round(newLoanBal)
    const combinedNetWorth   = combinedPropValue - combinedLoanBal
    const combinedAnnualCF   = basePoint.annualCashFlow + addedCF

    cumulativeCFWithNew = (idx > 0 && year > acquisitionYear)
      ? cumulativeCFWithNew + addedCF
      : basePoint.cumulativeCF + addedCF

    return {
      ...basePoint,
      propertyValue: combinedPropValue,
      loanBalance:   combinedLoanBal,
      netWorth:      combinedNetWorth,
      annualCashFlow: combinedAnnualCF,
      cumulativeCF:  Math.round(basePoint.cumulativeCF + (
        // track additive CF contribution from new property from year 0 onward
        // for simplicity: accumulate the per-year extra CF
        addedCF
      )),
      totalReturn:   Math.round(combinedNetWorth + basePoint.cumulativeCF + addedCF),
    }
  })

  // Rebuild cumulative CF properly in one pass
  let runningExtraCF = 0
  const withNewFixed = withNew.map((pt, idx) => {
    if (pt.year < acquisitionYear) return pt
    const basePt = baseline[idx]
    const extraCF = pt.annualCashFlow - basePt.annualCashFlow
    runningExtraCF += extraCF
    const newCumulCF = basePt.cumulativeCF + runningExtraCF
    return {
      ...pt,
      cumulativeCF: Math.round(newCumulCF),
      totalReturn:  Math.round(pt.netWorth + newCumulCF),
    }
  })

  const delta = baseline.map((basePt, i) => ({
    year:          basePt.year,
    label:         basePt.label,
    netWorth:      withNewFixed[i].netWorth      - basePt.netWorth,
    annualCashFlow: withNewFixed[i].annualCashFlow - basePt.annualCashFlow,
    cumulativeCF:  withNewFixed[i].cumulativeCF  - basePt.cumulativeCF,
    totalReturn:   withNewFixed[i].totalReturn   - basePt.totalReturn,
    propertyValue: withNewFixed[i].propertyValue - basePt.propertyValue,
    loanBalance:   withNewFixed[i].loanBalance   - basePt.loanBalance,
  }))

  return { baseline, withNew: withNewFixed, delta }
}

// Exported so PropertySimulator can use it without importing the private one
export function monthsBetweenPublic(dateA, dateB) {
  return (dateB.getFullYear() - dateA.getFullYear()) * 12 + (dateB.getMonth() - dateA.getMonth())
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Format a number as EUR currency string (Belgian locale) */
export function formatEUR(value) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Format a percentage with 1 decimal */
export function formatPct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

// ─── Property Scenario Comparison (New) ───────────────────────────────────────

/**
 * Calculate net proceeds for a specific property sale with Belgian tax rules
 * 
 * @param {Object} property - Property object
 * @param {Number} saleYear - Year of sale (0 = now)
 * @param {Object} taxConfig - { capitalGainsRate: 0.165 }
 * @param {Object} costConfig - { brokeragePct: 0.03, prepaymentPct: 0.01 }
 * @returns {Object} - Detailed breakdown of sale proceeds
 */
export function computePropertySaleProceeds(property, saleYear, taxConfig = {}, costConfig = {}) {
  const today = new Date()
  const saleDate = new Date(today.getFullYear() + saleYear, today.getMonth(), today.getDate())
  const saleDateISO = saleDate.toISOString()
  
  const brokeragePct = costConfig.brokeragePct ?? 0.03
  const prepaymentPct = costConfig.prepaymentPct ?? 0.01
  
  // Calculate appreciated value
  const saleValue = property.currentValue * Math.pow(1 + (property.appreciationRate || 0.02), saleYear)
  
  // Calculate remaining loan balance
  let totalLoanBalance = 0
  for (const loan of property.loans || []) {
    totalLoanBalance += getRemainingBalance(loan, saleDateISO)
  }
  
  // Transaction costs
  const brokerageFee = saleValue * brokeragePct
  const prepaymentPenalty = totalLoanBalance * prepaymentPct
  
  // Belgian capital gains tax: 16.5% if sold within 5 years of purchase
  let capitalGainsTax = 0
  const purchaseDate = new Date(property.purchaseDate)
  const yearsSincePurchase = saleYear + (today.getFullYear() - purchaseDate.getFullYear())
  
  if (yearsSincePurchase < 5 && taxConfig.capitalGainsApplies !== false) {
    const capitalGain = Math.max(0, saleValue - property.purchasePrice)
    capitalGainsTax = capitalGain * (taxConfig.capitalGainsRate ?? 0.165)
  }
  
  const netProceeds = saleValue - totalLoanBalance - brokerageFee - prepaymentPenalty - capitalGainsTax
  
  return {
    grossValue: Math.round(saleValue),
    loanBalance: Math.round(totalLoanBalance),
    brokerageFee: Math.round(brokerageFee),
    prepaymentPenalty: Math.round(prepaymentPenalty),
    capitalGainsTax: Math.round(capitalGainsTax),
    netProceeds: Math.round(netProceeds),
    yearsSincePurchase,
  }
}

/**
 * Calculate after-tax rental income (Belgian tax rules)
 * 
 * @param {Number} grossRent - Annual gross rental income
 * @param {Object} taxConfig - { rentalWithholding: 0.30, useWithholding: true }
 * @returns {Number} - Net rental income after tax
 */
export function calculateRentalIncomeTax(grossRent, taxConfig = {}) {
  if (!taxConfig.useWithholding) {
    // User declares in personal income tax - we don't apply withholding here
    // (would need their marginal rate, which varies widely)
    return grossRent
  }
  
  const withholdingRate = taxConfig.rentalWithholding ?? 0.30
  return grossRent * (1 - withholdingRate)
}

/**
 * Calculate Belgian ETF taxation (0% capital gains, 30% on dividends)
 * 
 * @param {Number} currentValue - Current ETF value
 * @param {Number} principal - Original investment
 * @param {Number} dividendPct - Percentage of returns from dividends (0-1)
 * @returns {Number} - Annual tax owed on dividends
 */
export function calculateETFTax(currentValue, principal, dividendPct = 0) {
  // Belgian ETF tax: 0% on capital gains, 30% on dividends
  // For accumulating ETFs (dividendPct = 0), tax = 0
  const totalGain = Math.max(0, currentValue - principal)
  const dividendPortion = totalGain * dividendPct
  return Math.round(dividendPortion * 0.30)
}

/**
 * Build property-by-property scenario comparison
 * 
 * Compares:
 * - Baseline: Keep all properties as-is (current rental strategy)
 * - Custom: Per-property decisions (keep/sell/occupy) with investment options
 * 
 * @param {Array} properties - All properties in portfolio
 * @param {Object} scenarioConfig - {
 *   decisions: { 
 *     [propertyId]: { 
 *       action: 'keep'|'sell'|'occupy',
 *       saleYear: 0,
 *       investmentType: 'etf'|'bonds'|'savings'|'custom',
 *       investmentRate: 0.07
 *     }
 *   },
 *   taxConfig: {
 *     useWithholding: true,
 *     rentalWithholding: 0.30,
 *     capitalGainsApplies: true,
 *     capitalGainsRate: 0.165,
 *     etfDividendPct: 0
 *   }
 * }
 * @returns {Array} - 20-year projection with baseline and custom scenarios
 */
export function buildPropertyScenarioComparison(properties, scenarioConfig) {
  const { decisions = {}, taxConfig = {} } = scenarioConfig
  
  // Build baseline: all properties kept as-is
  const baseline = buildProjection(properties)
  
  // Track investments from sold properties
  const investments = {} // { propertyId: { principal, saleYear, rate, dividendPct } }
  
  // Build custom scenario year by year
  const customPoints = []
  let cumulativeCF = 0
  
  for (let year = 0; year <= 20; year++) {
    const today = new Date()
    const yearStart = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())
    const yearEnd = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())
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
      
      // Check if property has been sold in a previous year
      if (decision.action === 'sell' && year >= saleYear) {
        // Property sold - add to investments if not already tracked
        if (!investments[property.id]) {
          const saleProceeds = computePropertySaleProceeds(property, saleYear, taxConfig, {
            brokeragePct: 0.03,
            prepaymentPct: 0.01
          })
          
          investments[property.id] = {
            principal: saleProceeds.netProceeds,
            saleYear,
            rate: decision.investmentRate ?? 0.07,
            dividendPct: taxConfig.etfDividendPct ?? 0
          }
        }
        
        // Track investment growth
        const inv = investments[property.id]
        const yearsInvested = year - inv.saleYear
        const currentInvValue = inv.principal * Math.pow(1 + inv.rate, yearsInvested)
        investmentValue += currentInvValue
        
        // Calculate ETF tax for this year
        if (yearsInvested > 0) {
          investmentTaxThisYear += calculateETFTax(currentInvValue, inv.principal, inv.dividendPct)
        }
        
        // No property value or costs for sold properties
        continue
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
      if (decision.action === 'keep' && property.status === 'rented') {
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
  
  // Combine baseline and custom into comparison format
  return baseline.map((basePoint, idx) => ({
    year: basePoint.year,
    label: basePoint.label,
    baselineNetWorth: basePoint.netWorth,
    baselineCF: basePoint.cumulativeCF,
    customNetWorth: customPoints[idx].netWorth,
    customCF: customPoints[idx].cumulativeCF,
    delta: customPoints[idx].netWorth - basePoint.netWorth,
    deltaCF: customPoints[idx].cumulativeCF - basePoint.cumulativeCF,
    // Include detailed breakdown for tooltip
    baseline: basePoint,
    custom: customPoints[idx],
  }))
}
