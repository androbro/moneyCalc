/**
 * MoneyFlow.jsx
 *
 * A clear, scannable view of every euro in and out — both at the current
 * monthly snapshot and as a rolling year-by-year table for the next 10 years.
 *
 * Sections:
 *   1. Monthly snapshot  — every inflow and outflow line itemised with colour coding
 *   2. Net position cards — portfolio-only vs full household
 *   3. Year-by-year table — indexed rents, costs, cumulative cash flow (from buildProjection)
 *
 * Props:
 *   properties  – portfolio array
 *   profile     – householdProfile object
 */

import { useMemo, useState } from 'react'
import { buildProjection, computeSummary, getRemainingBalance } from '../utils/projectionUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)

const fmtSigned = (n) => (n >= 0 ? `+${fmt(n)}` : fmt(n))

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

/** A single labelled flow row with operator badge and coloured amount */
function FlowRow({ operator, label, sublabel, amount, dimmed = false, total = false, indent = false }) {
  const opColor =
    operator === '+' ? 'text-emerald-400' :
    operator === '−' ? 'text-red-400' :
    operator === '=' ? 'text-brand-400' : 'text-slate-500'

  const amtColor =
    total ? (amount >= 0 ? 'text-brand-400' : 'text-red-400') :
    operator === '+' ? 'text-emerald-400' :
    operator === '−' ? 'text-red-400' :
    operator === '~' ? 'text-amber-400' : 'text-white'

  return (
    <div
      className={`flex items-center justify-between py-2
        ${total ? 'border-t-2 border-slate-500 mt-1 pt-3' : 'border-b border-slate-700/40 last:border-0'}
        ${indent ? 'pl-5' : ''}
        ${dimmed ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className={`text-xs font-bold w-4 shrink-0 mt-0.5 ${opColor}`}>{operator}</span>
        <div className="min-w-0">
          <span className={`text-sm ${total ? 'font-semibold text-white' : 'text-slate-300'}`}>{label}</span>
          {sublabel && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{sublabel}</p>}
        </div>
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ml-4 ${amtColor}`}>
        {operator === '=' ? fmtSigned(amount) : fmt(amount)}
      </span>
    </div>
  )
}

/** Net KPI badge */
function NetBadge({ label, monthly, annual, positive }) {
  const color = positive ? 'text-emerald-400' : 'text-red-400'
  const bg    = positive ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-red-900/20 border-red-700/30'
  return (
    <div className={`card border ${bg} space-y-1 text-center`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{fmtSigned(monthly)}</p>
      <p className="text-xs text-slate-500">/month</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{fmtSigned(annual)}</p>
      <p className="text-xs text-slate-500">/year</p>
    </div>
  )
}

// ─── Year-by-year table ───────────────────────────────────────────────────────

function YearTable({ projection, householdAnnualSurplus }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? projection : projection.slice(0, 6)

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/60">
              <th className="text-left px-4 py-3 text-slate-400 font-semibold whitespace-nowrap">Year</th>
              <th className="text-right px-3 py-3 text-slate-400 font-semibold whitespace-nowrap">Portfolio Value</th>
              <th className="text-right px-3 py-3 text-slate-400 font-semibold whitespace-nowrap">Loan Balance</th>
              <th className="text-right px-3 py-3 text-slate-400 font-semibold whitespace-nowrap">Equity</th>
              <th className="text-right px-3 py-3 text-emerald-400/80 font-semibold whitespace-nowrap">Rental Income</th>
              <th className="text-right px-3 py-3 text-red-400/80 font-semibold whitespace-nowrap">Portfolio Costs</th>
              <th className="text-right px-3 py-3 text-slate-400 font-semibold whitespace-nowrap">Portfolio CF</th>
              <th className="text-right px-3 py-3 text-brand-400/80 font-semibold whitespace-nowrap">Cumulative CF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pt, i) => {
              const rentalIncome = pt.annualCashFlow + pt.annualCosts  // reverse-engineer: CF = income - costs
              const isToday = pt.year === 0
              return (
                <tr
                  key={pt.year}
                  className={`border-b border-slate-700/40 last:border-0 transition-colors
                    ${isToday ? 'bg-brand-600/10' : i % 2 === 0 ? '' : 'bg-slate-800/20'}
                    hover:bg-slate-700/20`}
                >
                  <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                    {isToday ? <span className="text-brand-300">Today</span> : pt.label}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-200 whitespace-nowrap">
                    {fmt(pt.propertyValue)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-300/80 whitespace-nowrap">
                    {fmt(pt.loanBalance)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-white whitespace-nowrap">
                    {fmt(pt.netWorth)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400 whitespace-nowrap">
                    {fmt(Math.max(0, rentalIncome))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-400 whitespace-nowrap">
                    {fmt(pt.annualCosts)}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap
                    ${pt.annualCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtSigned(pt.annualCashFlow)}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap
                    ${pt.cumulativeCF >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                    {fmtSigned(pt.cumulativeCF)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {projection.length > 6 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200
                     border-t border-slate-700 transition-colors hover:bg-slate-800/40"
        >
          {showAll ? 'Show fewer years ↑' : `Show all ${projection.length} years ↓`}
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MoneyFlow({ properties, profile }) {
  const data = useMemo(() => {
    // ── Portfolio-only flows (rental minus property costs) ──
    let monthlyRentalGross   = 0
    let monthlyPropertyOpex  = 0
    let monthlyPropertyLoans = 0

    const propertyLines = properties.map((p) => {
      const rent = p.isRented !== false ? (p.startRentalIncome || p.monthlyRentalIncome || 0) : 0
      const opex =
        (p.annualMaintenanceCost || 0) / 12 +
        (p.annualInsuranceCost   || 0) / 12 +
        (p.annualPropertyTax     || 0) / 12 +
        (p.monthlyExpenses       || 0)
      const loans = (p.loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0)
      const today = new Date().toISOString()
      const balance = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, today), 0)

      monthlyRentalGross   += rent
      monthlyPropertyOpex  += opex
      monthlyPropertyLoans += loans

      return { id: p.id, name: p.name, rent, opex, loans, balance, isRented: p.isRented }
    })

    const portfolioMonthlyCF = monthlyRentalGross - monthlyPropertyOpex - monthlyPropertyLoans

    // ── Household flows ──
    const members = profile.members || []
    const totalMemberSalary     = members.reduce((s, m) => s + (m.netIncome || 0), 0)
    const totalMemberInvestment = members.reduce((s, m) => s + (m.investmentIncome || 0), 0)
    const totalMemberCash       = members.reduce((s, m) => s + (m.cash || 0), 0)

    const householdExpenses  = profile.householdExpenses || 0
    const newResidenceLoan   = profile.newResidenceMonthlyPayment || 0
    const savingsRate        = profile.personalSavingsRate || 0

    const totalInflow = monthlyRentalGross + totalMemberSalary + totalMemberInvestment
    const savingsSetAside = totalInflow * savingsRate

    const totalOutflow =
      monthlyPropertyOpex + monthlyPropertyLoans +
      newResidenceLoan + householdExpenses + savingsSetAside

    const availableCash = totalInflow - totalOutflow

    // ── Projection ──
    const projection = buildProjection(properties)

    return {
      propertyLines,
      monthlyRentalGross,
      monthlyPropertyOpex,
      monthlyPropertyLoans,
      portfolioMonthlyCF,
      members,
      totalMemberSalary,
      totalMemberInvestment,
      totalMemberCash,
      householdExpenses,
      newResidenceLoan,
      savingsRate,
      savingsSetAside,
      totalInflow,
      totalOutflow,
      availableCash,
      projection,
    }
  }, [properties, profile])

  const {
    propertyLines,
    monthlyRentalGross,
    monthlyPropertyOpex,
    monthlyPropertyLoans,
    portfolioMonthlyCF,
    members,
    totalMemberSalary,
    totalMemberInvestment,
    totalMemberCash,
    householdExpenses,
    newResidenceLoan,
    savingsRate,
    savingsSetAside,
    totalInflow,
    totalOutflow,
    availableCash,
    projection,
  } = data

  const hasProfile = members.length > 0

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Money Flow</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Every euro in and out — monthly snapshot and year-by-year projection.
        </p>
      </div>

      {/* ── Net position cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NetBadge
          label="Portfolio Net Cash Flow"
          monthly={portfolioMonthlyCF}
          annual={portfolioMonthlyCF * 12}
          positive={portfolioMonthlyCF >= 0}
        />
        <NetBadge
          label="Household Surplus (investable)"
          monthly={availableCash}
          annual={availableCash * 12}
          positive={availableCash >= 0}
        />
      </div>

      {/* ── Monthly breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Portfolio flows */}
        <div className="card">
          <SectionHeader
            title="Portfolio Cash Flow"
            subtitle="Rental income minus all property obligations — monthly"
          />

          {properties.length === 0 ? (
            <p className="text-slate-500 text-sm">No properties in your portfolio yet.</p>
          ) : (
            <>
              {/* Per-property breakdown */}
              {propertyLines.map((p) => (
                <div key={p.id}>
                  {p.isRented !== false ? (
                    <FlowRow
                      operator="+"
                      label={p.name}
                      sublabel="gross rental income"
                      amount={p.rent}
                    />
                  ) : (
                    <FlowRow
                      operator=" "
                      label={p.name}
                      sublabel="not rented — no rental income"
                      amount={0}
                      dimmed
                    />
                  )}
                  {p.opex > 0 && (
                    <FlowRow
                      operator="−"
                      label="Operating costs"
                      sublabel={`${p.name} — maintenance, insurance, tax`}
                      amount={p.opex}
                      indent
                    />
                  )}
                  {p.loans > 0 && (
                    <FlowRow
                      operator="−"
                      label="Loan payments"
                      sublabel={`${p.name}`}
                      amount={p.loans}
                      indent
                    />
                  )}
                </div>
              ))}

              <FlowRow
                operator="="
                label="Portfolio Net Cash Flow"
                amount={portfolioMonthlyCF}
                total
              />
            </>
          )}
        </div>

        {/* Right — Household flows */}
        <div className="card">
          <SectionHeader
            title="Household Cash Flow"
            subtitle="All income sources minus all obligations — monthly"
          />

          {!hasProfile && (
            <p className="text-amber-400 text-xs mb-4">
              No household members configured — set up your profile for the full picture.
            </p>
          )}

          {/* Inflows */}
          {monthlyRentalGross > 0 && (
            <FlowRow operator="+" label="Rental Income" amount={monthlyRentalGross} sublabel="from portfolio" />
          )}
          {members.map((m) => {
            const total = (m.netIncome || 0) + (m.investmentIncome || 0)
            if (total === 0) return null
            const parts = []
            if (m.netIncome) parts.push(`salary ${fmt(m.netIncome)}`)
            if (m.investmentIncome) parts.push(`investments ${fmt(m.investmentIncome)}`)
            return (
              <FlowRow
                key={m.id}
                operator="+"
                label={`${m.name || 'Member'} — income`}
                sublabel={parts.join(' + ')}
                amount={total}
              />
            )
          })}

          {/* Divider */}
          <div className="border-t border-slate-600/50 my-2" />

          {/* Outflows */}
          {monthlyPropertyOpex > 0 && (
            <FlowRow operator="−" label="Property Operating Costs" amount={monthlyPropertyOpex}
              sublabel="maintenance, insurance, tax, other" />
          )}
          {monthlyPropertyLoans > 0 && (
            <FlowRow operator="−" label="Property Loan Payments" amount={monthlyPropertyLoans} />
          )}
          {newResidenceLoan > 0 && (
            <FlowRow operator="−" label="New Residence Loan" amount={newResidenceLoan}
              sublabel="joint mortgage payment" />
          )}
          {householdExpenses > 0 && (
            <FlowRow operator="−" label="Living Expenses" amount={householdExpenses}
              sublabel="household bills, food, transport…" />
          )}
          {savingsSetAside > 0 && (
            <FlowRow
              operator="~"
              label={`Savings set-aside (${(savingsRate * 100).toFixed(0)}%)`}
              amount={savingsSetAside}
              sublabel="reserved, not available to spend"
            />
          )}

          <FlowRow
            operator="="
            label="Available for New Investments"
            amount={availableCash}
            total
          />
        </div>
      </div>

      {/* ── Cash on hand ── */}
      {members.length > 0 && (
        <div className="card">
          <SectionHeader
            title="Cash on Hand"
            subtitle="Liquid reserves across all household members"
          />
          <div className="flex flex-wrap gap-4">
            {members.map((m) => (
              <div key={m.id}
                className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">
                <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/40
                                flex items-center justify-center text-brand-300 font-bold text-sm">
                  {(m.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-slate-400">{m.name || 'Unnamed'}</p>
                  <p className="text-base font-bold text-brand-300 tabular-nums">{fmt(m.cash || 0)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3
                            border border-dashed border-slate-600">
              <div>
                <p className="text-xs text-slate-500">Total household cash</p>
                <p className="text-base font-bold text-white tabular-nums">{fmt(totalMemberCash)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Year-by-year projection table ── */}
      <div>
        <SectionHeader
          title="Year-by-Year Projection"
          subtitle="Portfolio cash flows projected 20 years forward with indexed rents and costs. Household salaries are not included — portfolio-only."
        />
        {properties.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-slate-500 text-sm">Add properties to see the projection.</p>
          </div>
        ) : (
          <YearTable projection={projection} householdAnnualSurplus={availableCash * 12} />
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span><span className="text-emerald-400 font-semibold">Green</span> — income / positive flow</span>
        <span><span className="text-red-400 font-semibold">Red</span> — cost / negative flow</span>
        <span><span className="text-amber-400 font-semibold">Amber</span> — savings set-aside</span>
        <span><span className="text-brand-400 font-semibold">Blue</span> — net result / equity</span>
        <span>Portfolio CF = rental income − operating costs − loan payments (salaries excluded)</span>
      </div>

    </div>
  )
}
