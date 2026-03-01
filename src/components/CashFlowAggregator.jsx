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

    const householdExp = profile.householdExpenses || 0

    const totalOutflowBeforeSavings =
      monthlyPropertyOpex + monthlyPropertyLoans + householdExp

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
      householdExp,
      savingsSetAside,
      totalOutflow,
      availableCash,
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
    householdExp,
    savingsSetAside,
    totalOutflow,
    availableCash,
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
          <FormulaRow operator="−" label="Property Loan Payments" value={monthlyPropertyLoans} color="text-red-400" />
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


        </div>
      </div>
    </div>
  )
}
