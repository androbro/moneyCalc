import { useState } from 'react'
import {
  AreaChart, Area,
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { buildProjection, formatEUR } from '../utils/projectionUtils'

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

  const items = [
    { label: 'Property gain (20y)',  value: formatEUR(propGain),      color: 'text-emerald-400', prefix: '+' },
    { label: 'Debt repaid (20y)',    value: formatEUR(loanReduction),  color: 'text-brand-400',   prefix: '-' },
    { label: 'Net worth gain (20y)', value: formatEUR(netWorthGain),   color: netWorthGain >= 0 ? 'text-emerald-400' : 'text-red-400', prefix: netWorthGain >= 0 ? '+' : '' },
    { label: 'Cumulative cash flow', value: formatEUR(totalCF),        color: totalCF >= 0 ? 'text-emerald-400' : 'text-red-400', prefix: totalCF >= 0 ? '+' : '' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      {items.map((item) => (
        <div key={item.label} className="bg-slate-700/50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1 leading-tight">{item.label}</p>
          <p className={`text-base font-bold ${item.color}`}>
            {item.prefix}{item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Property breakdown table ─────────────────────────────────────────────────

function PropertyBreakdown({ properties }) {
  return (
    <div className="card overflow-x-auto">
      <h3 className="section-title">Property Breakdown</h3>
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-700">
            {['Property', 'Current Value', '+5y Value', '+20y Value', 'Appre. Rate', 'Rent Index', 'Loans'].map((h, i) => (
              <th key={h} className={`py-2 text-slate-400 font-medium text-xs ${i === 0 ? 'text-left pr-3' : 'text-right px-2'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {properties.map((p) => {
            const r  = p.appreciationRate || 0.02
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
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="border-b border-slate-700">
            {['Year', 'Property Value', 'Loan Balance', 'Net Worth', 'Annual CF', 'Cumulative CF'].map((h, i) => (
              <th key={h} className={`py-2 text-slate-400 font-medium text-xs ${i === 0 ? 'text-left pr-3' : 'text-right px-2'}`}>{h}</th>
            ))}
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
              <td className={`py-2 pl-2 text-right font-semibold ${row.cumulativeCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.cumulativeCF >= 0 ? '+' : ''}{formatEUR(row.cumulativeCF)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

export default function ProjectionChart({ properties }) {
  if (!properties || properties.length === 0) return <EmptyState />

  const data = buildProjection(properties)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">20-Year Projection</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Indexed rental income, inflation-adjusted costs, and amortization-based loan balance
        </p>
      </div>

      {/* Chart 1: Net Worth (area) */}
      <div className="card">
        <h2 className="font-semibold text-slate-100 mb-5">Portfolio Value vs. Debt</h2>
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
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '12px' }} />
            <Area type="monotone" dataKey="propertyValue" name="Property Value" stroke="#10b981" strokeWidth={2} fill="url(#gProp)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="loanBalance"   name="Loan Balance"   stroke="#ef4444" strokeWidth={2} fill="url(#gLoan)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="netWorth"      name="Net Worth"       stroke="#38bdf8" strokeWidth={2.5} fill="url(#gNW)" dot={false} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
        <SummaryStrip data={data} />
      </div>

      {/* Chart 2: Cash Flow (bars + cumulative line) */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-slate-100">Net Cash Flow per Year</h2>
            <p className="text-xs text-slate-400 mt-0.5">Indexed rent minus indexed costs and loan payments</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis yAxisId="left"  tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
            <YAxis yAxisId="right" tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} orientation="right" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '12px' }} />
            <ReferenceLine yAxisId="left" y={0} stroke="#475569" strokeDasharray="4 2" />
            <Bar
              yAxisId="left"
              dataKey="annualCashFlow"
              name="Annual CF"
              fill="#0ea5e9"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeCF"
              name="Cumulative CF"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#a78bfa' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Property breakdown + CF table */}
      <PropertyBreakdown properties={properties} />
      <CashFlowTable data={data} />
    </div>
  )
}
