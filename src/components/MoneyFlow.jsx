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
import { buildProjection, computeSummary, getRemainingBalance, isRentalActiveOn, getLoanPaymentSplit } from '../utils/projectionUtils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

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
    operator === '=' ? 'text-brand-400' :
    operator === '↑' ? 'text-teal-400' : 'text-slate-500'

  const amtColor =
    total ? (amount >= 0 ? 'text-brand-400' : 'text-red-400') :
    operator === '+' ? 'text-emerald-400' :
    operator === '−' ? 'text-red-400' :
    operator === '~' ? 'text-amber-400' :
    operator === '↑' ? 'text-teal-400' : 'text-white'

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

// ─── Palette for investment position series ───────────────────────────────────

const POSITION_COLORS = [
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#a78bfa', // violet-400
  '#f43f5e', // rose-500
  '#34d399', // emerald-400
  '#60a5fa', // blue-400
  '#fb923c', // orange-400
]

// ─── Investment projection math ───────────────────────────────────────────────

/**
 * Build a 21-year (year 0 → 20) compound growth projection for a set of
 * investment positions. Each position contributes monthly, compounding at
 * its own annualReturn rate.
 *
 * Formula per year Y, position P:
 *   FV = monthlyAmount * [((1+r)^Y - 1) / r]   where r = annualReturn/12
 *   (future value of a regular monthly annuity, beginning-of-period)
 *
 * @param {Array} positions — [{ id, name, monthlyAmount, annualReturn }]
 * @param {number} years    — horizon (default 20)
 * @returns Array of { year, label, total, ...positionId: value }
 */
function buildInvestmentProjection(positions, years = 20) {
  const active = (positions || []).filter((p) => p.monthlyAmount > 0)
  const result = []

  for (let y = 0; y <= years; y++) {
    const pt = { year: y, label: y === 0 ? 'Today' : `+${y}y`, total: 0 }
    for (const pos of active) {
      const r = (pos.annualReturn || 0) / 12
      let fv
      if (r === 0) {
        fv = (pos.monthlyAmount || 0) * y * 12
      } else {
        // FV of ordinary annuity × 12 months/yr × y years
        const n = y * 12
        fv = (pos.monthlyAmount || 0) * ((Math.pow(1 + r, n) - 1) / r)
      }
      pt[pos.id] = Math.round(fv)
      pt.total += Math.round(fv)
    }
    result.push(pt)
  }
  return { data: result, active }
}

// ─── Investment chart tooltip ─────────────────────────────────────────────────

function InvTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-xs min-w-[200px]">
      <p className="font-semibold text-white mb-2 text-sm">{label}</p>
      {[...payload].reverse().map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-white font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-600 pt-1.5 mt-1.5 font-semibold">
        <span className="text-slate-300">Total</span>
        <span className="text-brand-300">{fmt(total)}</span>
      </div>
    </div>
  )
}

// ─── kFmt for axis ────────────────────────────────────────────────────────────

function kFmt(v) {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v}`
}

// ─── Investment section ───────────────────────────────────────────────────────

function InvestmentSection({ members }) {
  // Collect all positions across all members, tagging each with the member name
  const allPositions = useMemo(() => {
    const out = []
    for (const m of members) {
      for (const pos of (m.investmentPositions || [])) {
        if ((pos.monthlyAmount || 0) > 0) {
          out.push({
            ...pos,
            memberName: m.name || 'Member',
            displayName: pos.name
              ? `${pos.name}${members.length > 1 ? ` (${m.name})` : ''}`
              : `Position (${m.name || 'Member'})`,
          })
        }
      }
    }
    return out
  }, [members])

  const { data: chartData, active } = useMemo(
    () => buildInvestmentProjection(allPositions),
    [allPositions]
  )

  const [showTable, setShowTable] = useState(false)

  if (allPositions.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-slate-400 text-sm font-medium">No investment positions configured.</p>
        <p className="text-slate-500 text-xs mt-1">
          Add positions in the Household Profile → member cards to see your portfolio grow here.
        </p>
      </div>
    )
  }

  const final = chartData[chartData.length - 1]
  const totalMonthly = allPositions.reduce((s, p) => s + (p.monthlyAmount || 0), 0)
  const totalContributed = totalMonthly * 12 * 20
  const totalGrowth = final.total - totalContributed

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center space-y-0.5">
          <p className="text-xs text-slate-400">Monthly Invested</p>
          <p className="text-xl font-bold text-emerald-400">{fmt(totalMonthly)}</p>
          <p className="text-xs text-slate-500">{fmt(totalMonthly * 12)}/yr</p>
        </div>
        <div className="card text-center space-y-0.5">
          <p className="text-xs text-slate-400">Positions</p>
          <p className="text-xl font-bold text-white">{allPositions.length}</p>
          <p className="text-xs text-slate-500">active</p>
        </div>
        <div className="card text-center space-y-0.5">
          <p className="text-xs text-slate-400">+20y Portfolio Value</p>
          <p className="text-xl font-bold text-brand-400">{kFmt(final.total)}</p>
          <p className="text-xs text-slate-500">projected</p>
        </div>
        <div className="card text-center space-y-0.5">
          <p className="text-xs text-slate-400">+20y Investment Gain</p>
          <p className={`text-xl font-bold ${totalGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {kFmt(totalGrowth)}
          </p>
          <p className="text-xs text-slate-500">vs {kFmt(totalContributed)} contributed</p>
        </div>
      </div>

      {/* Positions summary table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-2 pr-3 font-medium">Position</th>
              <th className="text-right py-2 pr-3 font-medium">Monthly</th>
              <th className="text-right py-2 pr-3 font-medium">Annual</th>
              <th className="text-right py-2 pr-3 font-medium">Return %</th>
              <th className="text-right py-2 font-medium">+20y Value</th>
            </tr>
          </thead>
          <tbody>
            {allPositions.map((pos, i) => (
              <tr key={pos.id} className="border-b border-slate-700/40 last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: POSITION_COLORS[i % POSITION_COLORS.length] }}
                    />
                    <span className="text-slate-200 font-medium">{pos.displayName}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-emerald-400 tabular-nums">{fmt(pos.monthlyAmount)}</td>
                <td className="py-2 pr-3 text-right text-slate-300 tabular-nums">{fmt(pos.monthlyAmount * 12)}</td>
                <td className="py-2 pr-3 text-right text-amber-400 tabular-nums">
                  {((pos.annualReturn || 0) * 100).toFixed(1)}%
                </td>
                <td className="py-2 text-right font-semibold text-brand-400 tabular-nums">
                  {kFmt(final[pos.id] || 0)}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr className="border-t-2 border-slate-500 font-semibold">
              <td className="py-2 pr-3 text-white">Total</td>
              <td className="py-2 pr-3 text-right text-emerald-400 tabular-nums">{fmt(totalMonthly)}</td>
              <td className="py-2 pr-3 text-right text-slate-300 tabular-nums">{fmt(totalMonthly * 12)}</td>
              <td className="py-2 pr-3" />
              <td className="py-2 text-right text-brand-300 tabular-nums">{kFmt(final.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Stacked area chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-1">Portfolio Value Over Time</h3>
        <p className="text-xs text-slate-500 mb-4">
          Compound growth of each position assuming constant monthly contributions and fixed annual return.
          Assumes dividends reinvested. Tax on gains not modelled.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {active.map((pos, i) => (
                <linearGradient key={pos.id} id={`grad-${pos.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={POSITION_COLORS[i % POSITION_COLORS.length]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={POSITION_COLORS[i % POSITION_COLORS.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tickFormatter={kFmt} tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
            <Tooltip content={<InvTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              formatter={(value) => <span style={{ color: '#cbd5e1' }}>{value}</span>}
            />
            {active.map((pos, i) => (
              <Area
                key={pos.id}
                type="monotone"
                dataKey={pos.id}
                name={pos.displayName}
                stackId="1"
                stroke={POSITION_COLORS[i % POSITION_COLORS.length]}
                fill={`url(#grad-${pos.id})`}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Year-by-year table toggle */}
      <div className="card overflow-hidden p-0">
        <button
          onClick={() => setShowTable((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300
                     hover:text-white hover:bg-slate-800/40 transition-colors"
        >
          <span className="font-medium">Year-by-Year Breakdown</span>
          <span className="text-slate-500 text-xs">{showTable ? '↑ hide' : '↓ show'}</span>
        </button>

        {showTable && (
          <div className="overflow-x-auto border-t border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60 text-slate-400">
                  <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Year</th>
                  {active.map((pos, i) => (
                    <th key={pos.id} className="text-right px-3 py-2.5 font-medium whitespace-nowrap">
                      <span className="flex items-center justify-end gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: POSITION_COLORS[i % POSITION_COLORS.length] }}
                        />
                        {pos.displayName}
                      </span>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-medium text-brand-400/80 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((pt, i) => (
                  <tr
                    key={pt.year}
                    className={`border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20
                      ${pt.year === 0 ? 'bg-brand-600/10' : i % 2 === 0 ? '' : 'bg-slate-800/20'}`}
                  >
                    <td className="px-4 py-2 font-semibold text-white whitespace-nowrap">
                      {pt.year === 0 ? <span className="text-brand-300">Today</span> : pt.label}
                    </td>
                    {active.map((pos) => (
                      <td key={pos.id} className="px-3 py-2 text-right tabular-nums text-slate-200 whitespace-nowrap">
                        {kFmt(pt[pos.id] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand-400 whitespace-nowrap">
                      {kFmt(pt.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MoneyFlow({ properties, profile }) {
  const data = useMemo(() => {
    const today = new Date()
    const todayISO = today.toISOString()

    // ── Portfolio-only flows ──
    let monthlyRentalGross   = 0
    let monthlyPropertyOpex  = 0
    let monthlyInterestTotal = 0
    let monthlyCapitalTotal  = 0

    const propertyLines = properties.map((p) => {
      // Rental income only if currently active (respects rentalStartDate)
      const rentalActive = isRentalActiveOn(p, today)
      const rent = rentalActive ? (p.startRentalIncome || p.monthlyRentalIncome || 0) : 0

      const opex =
        (p.annualMaintenanceCost || 0) / 12 +
        (p.annualInsuranceCost   || 0) / 12 +
        (p.annualPropertyTax     || 0) / 12 +
        (p.monthlyExpenses       || 0)

      // Split each loan into interest (cost) vs capital (equity-building)
      let monthlyInterest = 0
      let monthlyCapital  = 0
      for (const l of p.loans || []) {
        const split = getLoanPaymentSplit(l, today)
        monthlyInterest += split.monthlyInterest
        monthlyCapital  += split.monthlyCapital
      }

      const balance = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, todayISO), 0)

      monthlyRentalGross   += rent
      monthlyPropertyOpex  += opex
      monthlyInterestTotal += monthlyInterest
      monthlyCapitalTotal  += monthlyCapital

      return {
        id: p.id, name: p.name, rent, opex,
        monthlyInterest, monthlyCapital,
        balance, rentalActive,
        status: p.status ?? (p.isRented ? 'rented' : 'owner_occupied'),
      }
    })

    // CF = rent - opex - interest (capital excluded — builds equity)
    const portfolioMonthlyCF = monthlyRentalGross - monthlyPropertyOpex - monthlyInterestTotal

    // ── Household flows ──
    const members = profile.members || []
    const totalMemberSalary     = members.reduce((s, m) => s + (m.netIncome || 0), 0)
    const totalMemberInvestment = members.reduce((s, m) => s + (m.investmentIncome || 0), 0)
    const totalMemberCash       = members.reduce((s, m) => s + (m.cash || 0), 0)

    const householdExpenses = profile.householdExpenses || 0
    const savingsRate       = profile.personalSavingsRate || 0

    const totalInflow = monthlyRentalGross + totalMemberSalary + totalMemberInvestment
    const savingsSetAside = totalInflow * savingsRate

    // Outflow uses interest-only (capital is equity-building, not a true cost)
    const totalOutflow =
      monthlyPropertyOpex + monthlyInterestTotal +
      householdExpenses + savingsSetAside

    const availableCash = totalInflow - totalOutflow

    // ── Projection ──
    const projection = buildProjection(properties)

    return {
      propertyLines,
      monthlyRentalGross,
      monthlyPropertyOpex,
      monthlyInterestTotal,
      monthlyCapitalTotal,
      portfolioMonthlyCF,
      members,
      totalMemberSalary,
      totalMemberInvestment,
      totalMemberCash,
      householdExpenses,
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
    monthlyInterestTotal,
    monthlyCapitalTotal,
    portfolioMonthlyCF,
    members,
    totalMemberSalary,
    totalMemberInvestment,
    totalMemberCash,
    householdExpenses,
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
                  {p.rentalActive ? (
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
                      sublabel={
                        p.status === 'rented'
                          ? 'rental not yet started'
                          : p.status === 'owner_occupied' ? 'owner-occupied — no rental income'
                          : p.status === 'vacant' ? 'vacant — no rental income'
                          : p.status === 'renovation' ? 'under renovation — no rental income'
                          : 'no rental income'
                      }
                      amount={0}
                      dimmed
                    />
                  )}
                  {p.opex > 0 && (
                    <FlowRow
                      operator="−"
                      label="Operating costs"
                      sublabel={`${p.name} — maintenance, insurance, tax, syndic`}
                      amount={p.opex}
                      indent
                    />
                  )}
                  {p.monthlyInterest > 0 && (
                    <FlowRow
                      operator="−"
                      label="Loan interest"
                      sublabel={`${p.name} — cost of borrowing`}
                      amount={p.monthlyInterest}
                      indent
                    />
                  )}
                  {p.monthlyCapital > 0 && (
                    <FlowRow
                      operator="↑"
                      label="Capital repayment"
                      sublabel={`${p.name} — builds equity`}
                      amount={p.monthlyCapital}
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
              sublabel="maintenance, insurance, tax, syndic" />
          )}
          {monthlyInterestTotal > 0 && (
            <FlowRow operator="−" label="Loan Interest" amount={monthlyInterestTotal}
              sublabel="true cost of borrowing across all properties" />
          )}
          {monthlyCapitalTotal > 0 && (
            <FlowRow operator="↑" label="Capital Repayment" amount={monthlyCapitalTotal}
              sublabel="equity building — not a true expense" />
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

      {/* ── Investment portfolio growth ── */}
      <div>
        <SectionHeader
          title="Investment Portfolio Growth"
          subtitle="Compound growth of your stock / ETF / savings positions over 20 years. Configure positions in the Household Profile."
        />
        <InvestmentSection members={members} />
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
