import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  AreaChart, Area,
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { buildProjection, formatEUR } from '../utils/projectionUtils'

// ─── Info popover ─────────────────────────────────────────────────────────────
// Renders into document.body via a portal so it is never clipped by
// overflow:hidden parents or table cells.  Position is calculated from
// getBoundingClientRect and flipped when close to a viewport edge.

const BUBBLE_W  = 256   // matches w-64
const BUBBLE_H  = 220   // generous estimate; actual height varies
const GAP       = 8     // px between button and bubble
const ARROW     = 8     // arrow height

function InfoPopover({ children }) {
  const [open, setOpen]     = useState(false)
  const [pos,  setPos]      = useState({ top: 0, left: 0, placement: 'top' })
  const btnRef              = useRef(null)
  const bubbleRef           = useRef(null)

  const reposition = useCallback(() => {
    if (!btnRef.current) return
    const r   = btnRef.current.getBoundingClientRect()
    const vw  = window.innerWidth
    const vh  = window.innerHeight
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    // Decide vertical placement: prefer above, fall back to below
    const spaceAbove = r.top
    const spaceBelow = vh - r.bottom
    const placement  = spaceAbove >= BUBBLE_H + GAP + ARROW || spaceAbove >= spaceBelow
      ? 'top'
      : 'bottom'

    // Horizontal: centre on button, then clamp to viewport with 8px margin
    let left = r.left + scrollX + r.width / 2 - BUBBLE_W / 2
    left = Math.max(8, Math.min(left, scrollX + vw - BUBBLE_W - 8))

    const top = placement === 'top'
      ? r.top  + scrollY - BUBBLE_H - GAP - ARROW
      : r.bottom + scrollY + GAP + ARROW

    setPos({ top, left, placement })
  }, [])

  // Re-run positioning when the actual bubble height is known
  const bubbleCallbackRef = useCallback((node) => {
    bubbleRef.current = node
    if (!node || !btnRef.current) return
    const r   = btnRef.current.getBoundingClientRect()
    const vh  = window.innerHeight
    const vw  = window.innerWidth
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    const actualH = node.offsetHeight
    const spaceAbove = r.top
    const spaceBelow = vh - r.bottom
    const placement  = spaceAbove >= actualH + GAP + ARROW || spaceAbove >= spaceBelow
      ? 'top'
      : 'bottom'
    let left = r.left + scrollX + r.width / 2 - BUBBLE_W / 2
    left = Math.max(8, Math.min(left, scrollX + vw - BUBBLE_W - 8))
    const top = placement === 'top'
      ? r.top  + scrollY - actualH - GAP - ARROW
      : r.bottom + scrollY + GAP + ARROW
    setPos({ top, left, placement })
  }, [])

  // Close on outside click, scroll, or resize
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        bubbleRef.current && !bubbleRef.current.contains(e.target)
      ) setOpen(false)
    }
    const closeImmediate = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll',  closeImmediate, true)
    window.addEventListener('resize',  closeImmediate)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll',  closeImmediate, true)
      window.removeEventListener('resize',  closeImmediate)
    }
  }, [open])

  const handleClick = (e) => {
    e.stopPropagation()
    if (!open) reposition()
    setOpen((v) => !v)
  }

  // Arrow points toward the button
  const arrowStyle = pos.placement === 'top'
    ? { bottom: -ARROW, left: '50%', transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderTop: `${ARROW}px solid #64748b` }
    : { top: -ARROW, left: '50%', transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderBottom: `${ARROW}px solid #64748b` }

  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className="w-4 h-4 rounded-full bg-slate-600 hover:bg-brand-600 text-slate-300
                   hover:text-white flex items-center justify-center transition-colors
                   text-[10px] font-bold leading-none shrink-0"
        aria-label="Show explanation"
      >
        ?
      </button>

      {open && createPortal(
        <div
          ref={bubbleCallbackRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: BUBBLE_W, zIndex: 9999 }}
          className="bg-slate-700 border border-slate-500 rounded-xl p-3 shadow-2xl
                     text-xs text-slate-200 leading-relaxed"
        >
          <span style={{ position: 'absolute', width: 0, height: 0, ...arrowStyle }} />
          {children}
        </div>,
        document.body
      )}
    </span>
  )
}

// ─── Explanation texts (single source of truth) ───────────────────────────────

const INFO = {
  propertyValue: (
    <>
      <strong className="text-white block mb-1">Property Value</strong>
      Your current market value grown by the appreciation rate you set, compounded yearly.
      <br /><br />
      <code className="text-brand-300">Value × (1 + rate)^year</code>
      <br /><br />
      Example: €275,000 at 2%/yr → €408,986 after 20 years.
    </>
  ),
  loanBalance: (
    <>
      <strong className="text-white block mb-1">Loan Balance</strong>
      The outstanding capital still owed to the bank at that point in time.
      <br /><br />
      Taken directly from the <strong>amortization schedule</strong> you uploaded (last row with a due date ≤ that year). If no CSV was uploaded, estimated with the standard annuity formula.
    </>
  ),
  netWorth: (
    <>
      <strong className="text-white block mb-1">Net Worth</strong>
      What you would walk away with if you sold everything and repaid all loans.
      <br /><br />
      <code className="text-brand-300">Net Worth = Property Value − Loan Balance</code>
      <br /><br />
      Does <em>not</em> subtract selling costs — see the Scenario Planner for that.
    </>
  ),
  annualCF: (
    <>
      <strong className="text-white block mb-1">Annual Cash Flow</strong>
      The net cash in your pocket for that year, after all income and costs.
      <br /><br />
      <code className="text-brand-300">
        Indexed Rent<br />
        − Indexed Maintenance<br />
        − Indexed Insurance<br />
        − Inflation-adjusted Other Costs<br />
        − Fixed Property Tax<br />
        − Loan Payments (from CSV or annuity)
      </code>
      <br /><br />
      Rent and costs increase each year by the rates you configured. Loan payments are fixed (or follow the uploaded schedule). Property tax is always the same amount.
    </>
  ),
  cumulativeCF: (
    <>
      <strong className="text-white block mb-1">Cumulative Cash Flow</strong>
      The running total of all annual cash flows from today up to that year.
      <br /><br />
      When this line crosses zero, your rental income has fully covered all costs paid so far — your <strong>cash breakeven point</strong>.
    </>
  ),
  propGain: (
    <>
      <strong className="text-white block mb-1">Property Gain (20y)</strong>
      How much more your portfolio is worth after 20 years of appreciation compared to today.
      <br /><br />
      <code className="text-brand-300">Value(+20y) − Value(today)</code>
    </>
  ),
  debtRepaid: (
    <>
      <strong className="text-white block mb-1">Debt Repaid (20y)</strong>
      How much of your total loan principal will have been repaid over 20 years.
      <br /><br />
      <code className="text-brand-300">Loan Balance(today) − Loan Balance(+20y)</code>
    </>
  ),
  netWorthGain: (
    <>
      <strong className="text-white block mb-1">Net Worth Gain (20y)</strong>
      Combined effect of appreciation and debt repayment over 20 years.
      <br /><br />
      <code className="text-brand-300">Net Worth(+20y) − Net Worth(today)</code>
      <br /><br />
      This is your total wealth creation, <em>excluding</em> cash flows.
    </>
  ),
  totalCF: (
    <>
      <strong className="text-white block mb-1">Cumulative Cash Flow (20y)</strong>
      Total cash generated (or consumed) by the portfolio over 20 years.
      <br /><br />
      Negative early on is normal — as rent is indexed upward and loans are repaid, cash flow typically turns positive.
    </>
  ),
  totalReturn: (
    <>
      <strong className="text-white block mb-1">Total Return</strong>
      Your true all-in return: equity <em>plus</em> every euro of rent received (or cost paid) so far.
      <br /><br />
      <code className="text-brand-300">Total Return = Net Worth + Cumulative Cash Flow</code>
      <br /><br />
      When this line rises above Net Worth, your rental income is adding meaningful real-world value on top of paper equity.
    </>
  ),
  cfTable: {
    propertyValue:  'Appreciated portfolio value at the start of that year.',
    loanBalance:    'Total outstanding debt across all loans at the start of that year.',
    netWorth:       'Property Value minus Loan Balance — your equity position.',
    annualCF:       'Net cash for this year: indexed rent minus all costs and loan payments.',
    cumulativeCF:   'Running total of all annual cash flows from Year 0 up to this row.',
    totalReturn:    'Net Worth + Cumulative Cash Flow — your true all-in return including both equity and cash generated.',
  },
  breakdownTable: {
    currentValue:  'Market value you entered for this property.',
    v5:            'Current value × (1 + appreciation rate)^5',
    v20:           'Current value × (1 + appreciation rate)^20',
    appRate:       'Annual appreciation rate configured on this property.',
    rentIndex:     'Annual rent indexation rate — how much rent grows each year.',
  },
}

// ─── Shared chart helpers ─────────────────────────────────────────────────────

function formatYAxis(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `€${(value / 1_000).toFixed(0)}k`
  return `€${value}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-xs min-w-[180px]">
      <p className="font-semibold text-white mb-2 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }} className="font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-white font-semibold">{formatEUR(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ data }) {
  const first = data[0]
  const last  = data[data.length - 1]
  const netWorthGain  = last.netWorth - first.netWorth
  const propGain      = last.propertyValue - first.propertyValue
  const loanReduction = first.loanBalance - last.loanBalance
  const totalCF       = last.cumulativeCF
  const totalReturn   = last.totalReturn - first.totalReturn

  const items = [
    {
      label: 'Property gain (20y)',
      value: formatEUR(propGain),
      color: 'text-emerald-400',
      prefix: '+',
      info: INFO.propGain,
    },
    {
      label: 'Debt repaid (20y)',
      value: formatEUR(loanReduction),
      color: 'text-brand-400',
      prefix: '-',
      info: INFO.debtRepaid,
    },
    {
      label: 'Net worth gain (20y)',
      value: formatEUR(netWorthGain),
      color: netWorthGain >= 0 ? 'text-emerald-400' : 'text-red-400',
      prefix: netWorthGain >= 0 ? '+' : '',
      info: INFO.netWorthGain,
    },
    {
      label: 'Cumulative cash flow',
      value: formatEUR(totalCF),
      color: totalCF >= 0 ? 'text-emerald-400' : 'text-red-400',
      prefix: totalCF >= 0 ? '+' : '',
      info: INFO.totalCF,
    },
    {
      label: 'Total return (20y)',
      value: formatEUR(totalReturn),
      color: totalReturn >= 0 ? 'text-amber-400' : 'text-red-400',
      prefix: totalReturn >= 0 ? '+' : '',
      info: INFO.totalReturn,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
      {items.map((item) => (
        <div key={item.label} className="bg-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1 leading-tight flex items-center justify-center gap-0.5">
            {item.label}
            <InfoPopover>{item.info}</InfoPopover>
          </p>
          <p className={`text-base font-bold ${item.color}`}>
            {item.prefix}{item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Property breakdown table ─────────────────────────────────────────────────

function ThWithInfo({ children, info, left = false }) {
  return (
    <th className={`py-2 text-slate-400 font-medium text-xs ${left ? 'text-left pr-3' : 'text-right px-2'}`}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        {info && <InfoPopover>{info}</InfoPopover>}
      </span>
    </th>
  )
}

function PropertyBreakdown({ properties }) {
  return (
    <div className="card overflow-x-auto">
      <h3 className="section-title">Property Breakdown</h3>
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-700">
            <ThWithInfo left>Property</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.currentValue}>Current Value</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.v5}>+5y Value</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.v20}>+20y Value</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.appRate}>Appre. Rate</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.rentIndex}>Rent Index</ThWithInfo>
            <ThWithInfo>Loans</ThWithInfo>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {properties.map((p) => {
            const r   = p.appreciationRate || 0.02
            const v5  = p.currentValue * Math.pow(1 + r, 5)
            const v20 = p.currentValue * Math.pow(1 + r, 20)
            return (
              <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-slate-200 whitespace-nowrap">{p.name}</td>
                <td className="py-2 px-2 text-right text-slate-200">{formatEUR(p.currentValue)}</td>
                <td className="py-2 px-2 text-right text-emerald-400">{formatEUR(v5)}</td>
                <td className="py-2 px-2 text-right text-emerald-400 font-semibold">{formatEUR(v20)}</td>
                <td className="py-2 px-2 text-right text-slate-300">{(r * 100).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-slate-300">{((p.indexationRate ?? 0.02) * 100).toFixed(1)}%</td>
                <td className="py-2 pl-2 text-right text-slate-400">{p.loans?.length || 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Annual cash flow table ───────────────────────────────────────────────────

function CashFlowTable({ data }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? data : data.slice(0, 6)

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Annual Cash Flow Detail</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          {expanded ? 'Show less' : 'Show all 20 years'}
        </button>
      </div>
      <table className="w-full text-sm min-w-[620px]">
        <thead>
          <tr className="border-b border-slate-700">
            <ThWithInfo left>Year</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.propertyValue}>Property Value</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.loanBalance}>Loan Balance</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.netWorth}>Net Worth</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.annualCF}>Annual CF</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.cumulativeCF}>Cumulative CF</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.totalReturn}>Total Return</ThWithInfo>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.year} className="hover:bg-slate-700/30 transition-colors">
              <td className="py-2 pr-3 text-slate-300 font-medium">{row.label}</td>
              <td className="py-2 px-2 text-right text-slate-200">{formatEUR(row.propertyValue)}</td>
              <td className="py-2 px-2 text-right text-red-400">{formatEUR(row.loanBalance)}</td>
              <td className="py-2 px-2 text-right font-semibold text-white">{formatEUR(row.netWorth)}</td>
              <td className={`py-2 px-2 text-right font-medium ${row.annualCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.annualCashFlow >= 0 ? '+' : ''}{formatEUR(row.annualCashFlow)}
              </td>
              <td className={`py-2 px-2 text-right font-semibold ${row.cumulativeCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.cumulativeCF >= 0 ? '+' : ''}{formatEUR(row.cumulativeCF)}
              </td>
              <td className={`py-2 pl-2 text-right font-bold ${row.totalReturn >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {row.totalReturn >= 0 ? '+' : ''}{formatEUR(row.totalReturn)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Chart legend with info popovers ─────────────────────────────────────────

function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: item.color }} />
          {item.label}
          <InfoPopover>{item.info}</InfoPopover>
        </span>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <p className="text-slate-300 font-medium">No data to project yet</p>
      <p className="text-slate-500 text-sm mt-1">Add at least one property to see the 20-year chart.</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Derive planned investment reference line labels ──────────────────────────

function getInvestmentMarkers(properties) {
  const today = new Date()
  // Collect unique year offsets with a label like "+3y: Kitchen (€15k)"
  const byYear = {}
  for (const p of properties) {
    for (const inv of p.plannedInvestments || []) {
      const invDate = new Date(inv.plannedDate)
      const yearOffset = Math.floor(
        (invDate.getFullYear() - today.getFullYear()) +
        (invDate.getMonth() - today.getMonth()) / 12
      )
      if (yearOffset < 0 || yearOffset > 20) continue
      const label = yearOffset === 0 ? 'Today' : `+${yearOffset}y`
      if (!byYear[label]) byYear[label] = []
      byYear[label].push(inv)
    }
  }
  return byYear  // { "+3y": [inv, ...], ... }
}

export default function ProjectionChart({ properties }) {
  if (!properties || properties.length === 0) return <EmptyState />

  const data = buildProjection(properties)
  const investmentMarkers = getInvestmentMarkers(properties)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">20-Year Projection</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Indexed rental income, inflation-adjusted costs, and amortization-based loan balance.
          Click any <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 text-[10px] font-bold text-slate-300 mx-0.5">?</span> for a detailed explanation.
        </p>
      </div>

      {/* ── Chart 1: Net Worth ── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <h2 className="font-semibold text-slate-100">Portfolio Value vs. Debt</h2>
          <ChartLegend items={[
            { label: 'Property Value', color: '#10b981', info: INFO.propertyValue },
            { label: 'Loan Balance',   color: '#ef4444', info: INFO.loanBalance },
            { label: 'Net Worth',      color: '#38bdf8', info: INFO.netWorth },
            { label: 'Total Return',   color: '#f59e0b', info: INFO.totalReturn },
          ]} />
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gProp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gLoan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.30} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gNW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.40} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gTotalReturn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.30} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="propertyValue" name="Property Value" stroke="#10b981" strokeWidth={2} fill="url(#gProp)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="loanBalance"   name="Loan Balance"   stroke="#ef4444" strokeWidth={2} fill="url(#gLoan)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="netWorth"      name="Net Worth"       stroke="#38bdf8" strokeWidth={2.5} fill="url(#gNW)"          dot={false} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="totalReturn"   name="Total Return"    stroke="#f59e0b" strokeWidth={2}   fill="url(#gTotalReturn)"  dot={false} activeDot={{ r: 4 }} strokeDasharray="5 3" />
            {Object.entries(investmentMarkers).map(([label, invs]) => (
              <ReferenceLine
                key={label}
                x={label}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{
                  value: `🔨 ${invs.length > 1 ? `${invs.length} investments` : (invs[0].description || 'Investment')}`,
                  position: 'insideTopRight',
                  fill: '#fbbf24',
                  fontSize: 10,
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>

        <SummaryStrip data={data} />
      </div>

      {/* ── Chart 2: Cash Flow ── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-slate-100">Net Cash Flow per Year</h2>
            <p className="text-xs text-slate-400 mt-0.5">Indexed rent minus indexed costs and loan payments</p>
          </div>
          <ChartLegend items={[
            { label: 'Annual CF',    color: '#0ea5e9', info: INFO.annualCF },
            { label: 'Cumulative CF', color: '#a78bfa', info: INFO.cumulativeCF },
          ]} />
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis yAxisId="left"  tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
            <YAxis yAxisId="right" tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} orientation="right" />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="left" y={0} stroke="#475569" strokeDasharray="4 2" />
            <Bar    yAxisId="left"  dataKey="annualCashFlow" name="Annual CF"    fill="#0ea5e9" radius={[4,4,0,0]} maxBarSize={32} />
            <Line   yAxisId="right" type="monotone" dataKey="cumulativeCF" name="Cumulative CF" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tables ── */}
      <PropertyBreakdown properties={properties} />
      <CashFlowTable data={data} />
    </div>
  )
}
