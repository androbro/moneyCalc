/**
 * CashFlowAggregator.jsx — Phase 8
 *
 * Live formula dashboard that combines:
 *   Rental Income (from portfolio)
 *   + Total Salaries (from household profile)
 *   + Investment Income (from household profile)
 *   − Property Loan Payments (from portfolio)
 *   − New Residence Loan Payment (from household profile)
 *   − Operating Expenses (from portfolio)
 *   − Household Expenses (from household profile)
 *   − Personal Savings Set-aside
 *   ─────────────────────────────────────────────
 *   = Available Cash for New Investments (monthly)
 *
 * It also shows:
 *   • Down-payment countdown: months until the target is reachable
 *   • Partner cash contribution status
 *
 * Props:
 *   properties  – current portfolio array
 *   profile     – household profile object
 *   onEditProfile – () => void   navigate to HouseholdForm
 */

import { useMemo } from 'react'
import { computeSummary } from '../utils/projectionUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)

function sign(n) {
  return n >= 0 ? `+${fmt(n)}` : fmt(n)
}

// ─── Row component ────────────────────────────────────────────────────────────

function FormulaRow({ label, value, color = 'text-white', sublabel, operator = '+', indent = false }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0 ${indent ? 'pl-4' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold w-4 shrink-0 ${
          operator === '+' ? 'text-emerald-400' :
          operator === '−' ? 'text-red-400' :
          operator === '=' ? 'text-brand-400' : 'text-slate-500'
        }`}>
          {operator}
        </span>
        <div>
          <span className="text-sm text-slate-300">{label}</span>
          {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
        </div>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{fmt(value)}</span>
    </div>
  )
}

function KpiCard({ label, value, color = 'text-white', sub }) {
  return (
    <div className="card text-center space-y-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CashFlowAggregator({ properties, profile, onEditProfile }) {
  const aggregated = useMemo(() => {
    const summary = computeSummary(properties)

    // ── Inflows ──
    const rentalIncome    = Math.max(0, summary.totalMonthlyCashFlow + (summary.annualNetCashFlow < 0 ? 0 : 0))
    // Recalculate monthly rental income directly so we can isolate it
    let monthlyRentalGross = 0
    for (const p of properties) {
      if (p.isRented !== false) {
        monthlyRentalGross += p.startRentalIncome || p.monthlyRentalIncome || 0
      }
    }
    const mySalary        = profile.myNetIncome || 0
    const investmentInc   = profile.myInvestmentIncome || 0
    const partnerSalary   = profile.partnerNetIncome || 0

    const totalInflow = monthlyRentalGross + mySalary + investmentInc + partnerSalary

    // ── Outflows ──
    // Property operating costs (monthly)
    let monthlyPropertyOpex = 0
    for (const p of properties) {
      monthlyPropertyOpex += (p.annualMaintenanceCost || 0) / 12
      monthlyPropertyOpex += (p.annualInsuranceCost || 0) / 12
      monthlyPropertyOpex += (p.annualPropertyTax || 0) / 12
      monthlyPropertyOpex += (p.monthlyExpenses || 0)
    }

    // Property loan payments (monthly total)
    let monthlyPropertyLoans = 0
    for (const p of properties) {
      for (const l of p.loans || []) {
        monthlyPropertyLoans += l.monthlyPayment || 0
      }
    }

    const newResidenceLoan = profile.newResidenceMonthlyPayment || 0
    const householdExp     = profile.householdExpenses || 0

    const totalOutflowBeforeSavings =
      monthlyPropertyOpex + monthlyPropertyLoans + newResidenceLoan + householdExp

    // Savings set-aside = savingsRate × total income
    const savingsRate     = profile.personalSavingsRate || 0
    const savingsSetAside = totalInflow * savingsRate

    const totalOutflow = totalOutflowBeforeSavings + savingsSetAside

    // ── Result ──
    const availableCash = totalInflow - totalOutflow

    // ── Down-payment progress ──
    const target       = profile.targetDownPayment || 0
    const partnerCash  = profile.partnerCash || 0
    const remaining    = Math.max(0, target - partnerCash)
    const monthsToGoal = availableCash > 0 && remaining > 0
      ? Math.ceil(remaining / availableCash)
      : null
    const targetYear   = profile.targetPurchaseYear || null

    return {
      monthlyRentalGross,
      mySalary,
      investmentInc,
      partnerSalary,
      totalInflow,
      monthlyPropertyOpex,
      monthlyPropertyLoans,
      newResidenceLoan,
      householdExp,
      savingsSetAside,
      totalOutflow,
      availableCash,
      partnerCash,
      target,
      remaining,
      monthsToGoal,
      targetYear,
    }
  }, [properties, profile])

  const {
    monthlyRentalGross,
    mySalary,
    investmentInc,
    partnerSalary,
    totalInflow,
    monthlyPropertyOpex,
    monthlyPropertyLoans,
    newResidenceLoan,
    householdExp,
    savingsSetAside,
    totalOutflow,
    availableCash,
    partnerCash,
    target,
    remaining,
    monthsToGoal,
    targetYear,
  } = aggregated

  const hasMissingProfile = mySalary === 0 && partnerSalary === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash-Flow Aggregator</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Combined household cash flow — rental income + salaries minus all obligations.
          </p>
        </div>
        <button onClick={onEditProfile} className="btn-secondary shrink-0">
          Edit Profile
        </button>
      </div>

      {/* Warning if profile not set */}
      {hasMissingProfile && (
        <div className="card border border-amber-700/40 bg-amber-900/10">
          <p className="text-amber-300 text-sm">
            Your household income is not configured yet.{' '}
            <button onClick={onEditProfile} className="underline hover:text-amber-200">
              Set up your profile
            </button>{' '}
            to see the full picture.
          </p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Monthly Inflow"
          value={fmt(totalInflow)}
          color="text-emerald-400"
        />
        <KpiCard
          label="Total Monthly Outflow"
          value={fmt(totalOutflow)}
          color="text-red-400"
        />
        <KpiCard
          label="Available for Investment"
          value={fmt(availableCash)}
          color={availableCash >= 0 ? 'text-brand-400' : 'text-red-400'}
          sub="per month"
        />
        <KpiCard
          label="Annual Investable"
          value={fmt(availableCash * 12)}
          color={availableCash >= 0 ? 'text-brand-400' : 'text-red-400'}
          sub="per year"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formula breakdown */}
        <div className="card space-y-1">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Formula Breakdown (Monthly)
          </h3>

          {/* Inflows */}
          <FormulaRow
            operator="+"
            label="Gross Rental Income"
            value={monthlyRentalGross}
            color="text-emerald-400"
            sublabel={`${properties.filter(p => p.isRented !== false).length} rented propert${properties.filter(p => p.isRented !== false).length === 1 ? 'y' : 'ies'}`}
          />
          <FormulaRow
            operator="+"
            label="Your Net Salary"
            value={mySalary}
            color="text-emerald-400"
          />
          <FormulaRow
            operator="+"
            label="Investment / Trading Income"
            value={investmentInc}
            color="text-emerald-400"
          />
          <FormulaRow
            operator="+"
            label="Partner Net Salary"
            value={partnerSalary}
            color="text-emerald-400"
          />

          {/* Separator */}
          <div className="border-t border-slate-600 my-1" />

          {/* Outflows */}
          <FormulaRow
            operator="−"
            label="Property Operating Costs"
            value={monthlyPropertyOpex}
            color="text-red-400"
            sublabel="maintenance + insurance + tax + other"
          />
          <FormulaRow
            operator="−"
            label="Property Loan Payments"
            value={monthlyPropertyLoans}
            color="text-red-400"
          />
          <FormulaRow
            operator="−"
            label="New Residence Loan Payment"
            value={newResidenceLoan}
            color="text-red-400"
          />
          <FormulaRow
            operator="−"
            label="Household Expenses"
            value={householdExp}
            color="text-red-400"
          />
          <FormulaRow
            operator="−"
            label={`Personal Savings (${(profile.personalSavingsRate * 100).toFixed(0)}% of income)`}
            value={savingsSetAside}
            color="text-amber-400"
            sublabel="set aside, not spent"
          />

          {/* Result */}
          <div className="border-t-2 border-slate-500 mt-1 pt-2">
            <FormulaRow
              operator="="
              label="Available for New Investments"
              value={availableCash}
              color={availableCash >= 0 ? 'text-brand-400' : 'text-red-400'}
            />
          </div>
        </div>

        {/* Down-payment progress */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Down Payment Progress
            </h3>

            {target === 0 ? (
              <p className="text-slate-500 text-sm">
                Set a target down payment in your profile to track progress.
              </p>
            ) : (
              <>
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Partner cash on hand</span>
                    <span>{fmt(Math.min(partnerCash, target))} / {fmt(target)}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className="bg-brand-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (partnerCash / target) * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {((partnerCash / target) * 100).toFixed(0)}% funded by partner cash
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-500">Still needed</p>
                    <p className="font-semibold text-white">{fmt(remaining)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-500">Months to goal</p>
                    <p className="font-semibold text-white">
                      {remaining === 0
                        ? 'Funded!'
                        : monthsToGoal !== null
                          ? `~${monthsToGoal}m`
                          : availableCash <= 0
                            ? 'No free cash'
                            : '—'}
                    </p>
                  </div>
                  {targetYear && (
                    <div className="space-y-0.5 col-span-2">
                      <p className="text-xs text-slate-500">Target purchase year</p>
                      <p className="font-semibold text-white">
                        {targetYear}
                        {monthsToGoal !== null && (() => {
                          const reachYear = new Date().getFullYear() + Math.ceil(monthsToGoal / 12)
                          const delta = reachYear - targetYear
                          if (delta <= 0) return <span className="ml-2 text-xs text-emerald-400">On track</span>
                          return <span className="ml-2 text-xs text-amber-400">{delta}y behind target</span>
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* New residence summary */}
          {profile.newResidencePrice > 0 && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                New Residence (Joint Purchase)
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Price</p>
                  <p className="font-semibold text-white">{fmt(profile.newResidencePrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Joint Loan</p>
                  <p className="font-semibold text-white">{fmt(profile.newResidenceLoanAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Down Payment Required</p>
                  <p className="font-semibold text-white">
                    {fmt(profile.newResidencePrice - profile.newResidenceLoanAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Partner Cash Covers</p>
                  <p className={`font-semibold ${
                    partnerCash >= (profile.newResidencePrice - profile.newResidenceLoanAmount)
                      ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {fmt(Math.min(partnerCash, profile.newResidencePrice - profile.newResidenceLoanAmount))}
                    {' '}
                    ({Math.min(100, Math.round(
                      (partnerCash / Math.max(1, profile.newResidencePrice - profile.newResidenceLoanAmount)) * 100
                    ))}%)
                  </p>
                </div>
                {profile.newResidenceMonthlyPayment > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">Monthly Payment (joint)</p>
                    <p className="font-semibold text-white">{fmt(profile.newResidenceMonthlyPayment)}</p>
                  </div>
                )}
                {profile.newResidencePurchaseDate && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">Planned Purchase</p>
                    <p className="font-semibold text-white">
                      {new Date(profile.newResidencePurchaseDate).toLocaleDateString('nl-BE', {
                        month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
