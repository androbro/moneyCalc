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
    // Recalculate monthly rental income directly so we can isolate it
    let monthlyRentalGross = 0
    for (const p of properties) {
      if (p.isRented !== false) {
        monthlyRentalGross += p.startRentalIncome || p.monthlyRentalIncome || 0
      }
    }

    // Sum across all household members
    const members = profile.members || []
    const totalMemberSalary     = members.reduce((s, m) => s + (m.netIncome || 0), 0)
    const totalMemberInvestment = members.reduce((s, m) => s + (m.investmentIncome || 0), 0)
    const totalMemberCash       = members.reduce((s, m) => s + (m.cash || 0), 0)

    const totalInflow = monthlyRentalGross + totalMemberSalary + totalMemberInvestment

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
    const remaining    = Math.max(0, target - totalMemberCash)
    const monthsToGoal = availableCash > 0 && remaining > 0
      ? Math.ceil(remaining / availableCash)
      : null
    const targetYear   = profile.targetPurchaseYear || null

    return {
      monthlyRentalGross,
      members,
      totalMemberSalary,
      totalMemberInvestment,
      totalMemberCash,
      totalInflow,
      monthlyPropertyOpex,
      monthlyPropertyLoans,
      newResidenceLoan,
      householdExp,
      savingsSetAside,
      totalOutflow,
      availableCash,
      target,
      remaining,
      monthsToGoal,
      targetYear,
    }
  }, [properties, profile])

  const {
    monthlyRentalGross,
    members,
    totalMemberSalary,
    totalMemberInvestment,
    totalMemberCash,
    totalInflow,
    monthlyPropertyOpex,
    monthlyPropertyLoans,
    newResidenceLoan,
    householdExp,
    savingsSetAside,
    totalOutflow,
    availableCash,
    target,
    remaining,
    monthsToGoal,
    targetYear,
  } = aggregated

  const hasMissingProfile = members.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash-Flow Aggregator</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Combined household cash flow — rental income + all members' income minus all obligations.
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
            No household members configured yet.{' '}
            <button onClick={onEditProfile} className="underline hover:text-amber-200">
              Set up your profile
            </button>{' '}
            to see the full picture.
          </p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Monthly Inflow"  value={fmt(totalInflow)}        color="text-emerald-400" />
        <KpiCard label="Total Monthly Outflow" value={fmt(totalOutflow)}       color="text-red-400" />
        <KpiCard label="Available for Investment" value={fmt(availableCash)}
          color={availableCash >= 0 ? 'text-brand-400' : 'text-red-400'} sub="per month" />
        <KpiCard label="Annual Investable" value={fmt(availableCash * 12)}
          color={availableCash >= 0 ? 'text-brand-400' : 'text-red-400'} sub="per year" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formula breakdown */}
        <div className="card space-y-1">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Formula Breakdown (Monthly)
          </h3>

          {/* Rental income */}
          <FormulaRow
            operator="+"
            label="Gross Rental Income"
            value={monthlyRentalGross}
            color="text-emerald-400"
            sublabel={`${properties.filter(p => p.isRented !== false).length} rented propert${properties.filter(p => p.isRented !== false).length === 1 ? 'y' : 'ies'}`}
          />

          {/* One row per member */}
          {members.map((m) => {
            const memberTotal = (m.netIncome || 0) + (m.investmentIncome || 0)
            const parts = []
            if (m.netIncome)        parts.push(`salary ${fmt(m.netIncome)}`)
            if (m.investmentIncome) parts.push(`investments ${fmt(m.investmentIncome)}`)
            return (
              <FormulaRow
                key={m.id}
                operator="+"
                label={`${m.name || 'Unnamed'} — Income`}
                value={memberTotal}
                color="text-emerald-400"
                sublabel={parts.join(' + ') || undefined}
              />
            )
          })}

          {/* Separator */}
          <div className="border-t border-slate-600 my-1" />

          {/* Outflows */}
          <FormulaRow operator="−" label="Property Operating Costs"  value={monthlyPropertyOpex}  color="text-red-400" sublabel="maintenance + insurance + tax + other" />
          <FormulaRow operator="−" label="Property Loan Payments"    value={monthlyPropertyLoans} color="text-red-400" />
          <FormulaRow operator="−" label="New Residence Loan Payment" value={newResidenceLoan}    color="text-red-400" />
          <FormulaRow operator="−" label="Household Expenses"        value={householdExp}         color="text-red-400" />
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

        {/* Right column */}
        <div className="space-y-4">

          {/* Members cash summary */}
          {members.length > 0 && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Household Members
              </h3>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-600/30 border border-brand-500/40
                                      flex items-center justify-center text-brand-300 font-bold text-xs">
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-300">{m.name || 'Unnamed'}</span>
                    </div>
                    <div className="flex gap-4 text-right text-xs">
                      <div>
                        <p className="text-slate-500">Income/mo</p>
                        <p className="text-emerald-400 font-semibold">
                          {fmt((m.netIncome || 0) + (m.investmentIncome || 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Cash</p>
                        <p className="text-brand-400 font-semibold">{fmt(m.cash || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-700 pt-2 flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Household totals</span>
                  <div className="flex gap-4 text-right">
                    <div>
                      <span className="text-emerald-400">{fmt(totalMemberSalary + totalMemberInvestment)}</span>
                      <span className="text-slate-500">/mo</span>
                    </div>
                    <div>
                      <span className="text-brand-400">{fmt(totalMemberCash)}</span>
                      <span className="text-slate-500"> cash</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Down-payment progress */}
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
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Total household cash on hand</span>
                    <span>{fmt(Math.min(totalMemberCash, target))} / {fmt(target)}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className="bg-brand-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (totalMemberCash / target) * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {((totalMemberCash / target) * 100).toFixed(0)}% funded by household cash
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
                  <p className="text-xs text-slate-500">Household Cash Covers</p>
                  {(() => {
                    const needed = profile.newResidencePrice - profile.newResidenceLoanAmount
                    const covered = Math.min(totalMemberCash, needed)
                    const pct = Math.min(100, Math.round((totalMemberCash / Math.max(1, needed)) * 100))
                    return (
                      <p className={`font-semibold ${totalMemberCash >= needed ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {fmt(covered)} ({pct}%)
                      </p>
                    )
                  })()}
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
