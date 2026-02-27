import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { buildProjection, formatEUR } from '../utils/projectionUtils'

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-xl text-sm">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-6 mb-1">
          <span style={{ color: entry.color }} className="font-medium">
            {entry.name}
          </span>
          <span className="text-white font-semibold">{formatEUR(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Y-axis formatter ────────────────────────────────────────────────────────

function formatYAxis(value) {
  if (Math.abs(value) >= 1_000_000)
    return `€${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000)
    return `€${(value / 1_000).toFixed(0)}k`
  return `€${value}`
}

// ─── Summary row below the chart ────────────────────────────────────────────

function ProjectionSummaryRow({ data }) {
  const first = data[0]
  const last = data[data.length - 1]

  const netWorthGain = last.netWorth - first.netWorth
  const propGain = last.propertyValue - first.propertyValue
  const loanReduction = first.loanBalance - last.loanBalance

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
      <div className="bg-slate-700/50 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400 mb-1">Property Appreciation (20y)</p>
        <p className="text-lg font-bold text-emerald-400">+{formatEUR(propGain)}</p>
      </div>
      <div className="bg-slate-700/50 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400 mb-1">Loan Repaid (20y)</p>
        <p className="text-lg font-bold text-brand-400">-{formatEUR(loanReduction)}</p>
      </div>
      <div className="bg-slate-700/50 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400 mb-1">Net Worth Gain (20y)</p>
        <p className={`text-lg font-bold ${netWorthGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {netWorthGain >= 0 ? '+' : ''}{formatEUR(netWorthGain)}
        </p>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <p className="text-slate-300 font-medium">No data to project yet</p>
      <p className="text-slate-500 text-sm mt-1">
        Add at least one property on the Properties page to see the 20-year chart.
      </p>
    </div>
  )
}

// ─── Per-property breakdown table ────────────────────────────────────────────

function PropertyBreakdown({ properties }) {
  const today = new Date().toISOString()

  return (
    <div className="card mt-6 overflow-x-auto">
      <h3 className="section-title">Property Breakdown</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 pr-4 text-slate-400 font-medium">Property</th>
            <th className="text-right py-2 px-2 text-slate-400 font-medium">Current Value</th>
            <th className="text-right py-2 px-2 text-slate-400 font-medium">+5y Value</th>
            <th className="text-right py-2 px-2 text-slate-400 font-medium">+20y Value</th>
            <th className="text-right py-2 pl-2 text-slate-400 font-medium">Loans</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {properties.map((p) => {
            const v5 = p.currentValue * Math.pow(1 + (p.appreciationRate || 0.02), 5)
            const v20 = p.currentValue * Math.pow(1 + (p.appreciationRate || 0.02), 20)
            const loans = (p.loans || []).length
            return (
              <tr key={p.id} className="hover:bg-slate-700/30">
                <td className="py-2 pr-4 font-medium text-slate-200">{p.name}</td>
                <td className="py-2 px-2 text-right text-slate-200">{formatEUR(p.currentValue)}</td>
                <td className="py-2 px-2 text-right text-emerald-400">{formatEUR(v5)}</td>
                <td className="py-2 px-2 text-right text-emerald-400 font-semibold">{formatEUR(v20)}</td>
                <td className="py-2 pl-2 text-right text-slate-400">{loans}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ProjectionChart({ properties }) {
  if (!properties || properties.length === 0) return <EmptyState />

  const data = buildProjection(properties)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">20-Year Projection</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Net worth forecast based on property appreciation and amortization schedules
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="font-semibold text-slate-100">Net Worth Over Time</h2>
          <div className="flex gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
              Property Value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
              Loan Balance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-brand-400 inline-block" />
              Net Worth
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPropertyValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradLoanBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />

            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />

            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={70}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="propertyValue"
              name="Property Value"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradPropertyValue)"
              dot={false}
              activeDot={{ r: 5, fill: '#10b981' }}
            />

            <Area
              type="monotone"
              dataKey="loanBalance"
              name="Loan Balance"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#gradLoanBalance)"
              dot={false}
              activeDot={{ r: 5, fill: '#ef4444' }}
            />

            <Area
              type="monotone"
              dataKey="netWorth"
              name="Net Worth"
              stroke="#38bdf8"
              strokeWidth={2.5}
              fill="url(#gradNetWorth)"
              dot={false}
              activeDot={{ r: 6, fill: '#38bdf8' }}
            />
          </AreaChart>
        </ResponsiveContainer>

        <ProjectionSummaryRow data={data} />
      </div>

      <PropertyBreakdown properties={properties} />
    </div>
  )
}
