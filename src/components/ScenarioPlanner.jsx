import { useState, useMemo } from 'react'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  buildScenarioComparison,
  computeSaleProceeds,
  formatEUR,
} from '../utils/projectionUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatYAxis(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `€${(value / 1_000).toFixed(0)}k`
  return `€${value}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-xs min-w-[200px]">
      <p className="font-semibold text-white mb-2 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="font-medium flex items-center gap-1.5" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-white font-semibold">{formatEUR(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Input row ────────────────────────────────────────────────────────────────

function ParamRow({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function PctInput({ value, onChange, step = '0.1', min = '0', max = '100', placeholder = '0.0' }) {
  return (
    <div className="relative">
      <input
        className="input pr-8"
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value !== '' ? (Number(value) * 100).toFixed(1) : ''}
        onChange={(e) => onChange(e.target.value !== '' ? Number(e.target.value) / 100 : 0)}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
    </div>
  )
}

// ─── Sale proceeds breakdown card ────────────────────────────────────────────

function SaleBreakdown({ sale, saleYear }) {
  if (!sale) return null

  const rows = [
    { label: `Projected sale value (Year ${saleYear})`, value: sale.totalSaleValue,    color: 'text-emerald-400' },
    { label: 'Remaining loan balance',                   value: -sale.totalLoanBalance, color: 'text-red-400' },
    { label: 'Brokerage commission',                     value: -sale.brokerage,        color: 'text-orange-400' },
    { label: 'Registration / notary fees',               value: -sale.registration,     color: 'text-orange-400' },
    { label: 'Bank prepayment penalty',                  value: -sale.prepaymentPenalty,color: 'text-orange-400' },
  ]

  return (
    <div className="card">
      <h3 className="section-title">Sale Proceeds — Year {saleYear}</h3>
      <div className="space-y-2 mb-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{r.label}</span>
            <span className={`font-medium ${r.color}`}>
              {r.value >= 0 ? '' : '−'}{formatEUR(Math.abs(r.value))}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
        <span className="font-semibold text-slate-200">Net Proceeds</span>
        <span className={`text-xl font-bold ${sale.netProceeds >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatEUR(sale.netProceeds)}
        </span>
      </div>
    </div>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────

function ComparisonTable({ data, saleYear }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? data : data.slice(0, 6)

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Year-by-Year Comparison</h3>
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
          {expanded ? 'Show less' : 'Show all 20 years'}
        </button>
      </div>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b border-slate-700">
            {['Year', 'Hold: Net Worth', 'Sell & Reinvest', 'Difference', 'Better'].map((h, i) => (
              <th key={h} className={`py-2 text-slate-400 font-medium text-xs ${i === 0 ? 'text-left pr-3' : 'text-right px-2'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => {
            const diff = row.holdValue - row.sellValue
            const holdBetter = diff > 0
            const saleMarker = row.year === saleYear

            return (
              <tr key={row.year}
                className={`transition-colors ${saleMarker ? 'bg-brand-900/20' : 'hover:bg-slate-700/30'}`}>
                <td className="py-2 pr-3 font-medium text-slate-200 whitespace-nowrap">
                  {row.label}
                  {saleMarker && (
                    <span className="ml-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full">
                      SELL
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-right text-emerald-400 font-medium">{formatEUR(row.holdValue)}</td>
                <td className="py-2 px-2 text-right text-violet-400 font-medium">{formatEUR(row.sellValue)}</td>
                <td className={`py-2 px-2 text-right font-medium ${holdBetter ? 'text-emerald-400' : 'text-violet-400'}`}>
                  {holdBetter ? '+' : ''}{formatEUR(diff)}
                </td>
                <td className="py-2 pl-2 text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    Math.abs(diff) < 1000
                      ? 'bg-slate-700 text-slate-300'
                      : holdBetter
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : 'bg-violet-900/40 text-violet-400'
                  }`}>
                    {Math.abs(diff) < 1000 ? 'Neutral' : holdBetter ? 'Hold' : 'Sell'}
                  </span>
                </td>
              </tr>
            )
          })}
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-slate-300 font-medium">No properties to analyse</p>
      <p className="text-slate-500 text-sm mt-1">Add at least one property to run scenario analysis.</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScenarioPlanner({ properties }) {
  const [saleYear,        setSaleYear]        = useState(10)
  const [brokeragePct,    setBrokeragePct]    = useState(0.03)
  const [registrationPct, setRegistrationPct] = useState(0)
  const [prepaymentPct,   setPrepaymentPct]   = useState(0.02)
  const [reinvestRate,    setReinvestRate]    = useState(0.05)

  const params = { brokeragePct, registrationPct, prepaymentPct, reinvestRate }

  const data = useMemo(
    () => properties.length > 0
      ? buildScenarioComparison(properties, saleYear, params)
      : [],
    [properties, saleYear, brokeragePct, registrationPct, prepaymentPct, reinvestRate]
  )

  const sale = useMemo(
    () => properties.length > 0
      ? computeSaleProceeds(properties, saleYear, params)
      : null,
    [properties, saleYear, brokeragePct, registrationPct, prepaymentPct]
  )

  if (!properties || properties.length === 0) return <EmptyState />

  // Find crossover year (if any)
  const crossover = data.find((d, i) => i > 0 && d.sellValue > d.holdValue && data[i - 1].sellValue <= data[i - 1].holdValue)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Scenario Planner</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Compare holding your portfolio against selling in a specific year and reinvesting the proceeds
        </p>
      </div>

      {/* ── Parameters panel ── */}
      <div className="card">
        <h2 className="font-semibold text-slate-100 mb-5">Scenario Parameters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          <ParamRow label="Sell in year" hint="Years from today when you simulate the sale">
            <input className="input" type="range" min="1" max="20" step="1"
              value={saleYear}
              onChange={(e) => setSaleYear(Number(e.target.value))} />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Year 1</span>
              <span className="text-brand-400 font-semibold">Year {saleYear}</span>
              <span>Year 20</span>
            </div>
          </ParamRow>

          <ParamRow label="Reinvestment return rate"
            hint="Annual return on the net proceeds after selling">
            <PctInput value={reinvestRate} onChange={setReinvestRate} placeholder="5.0" />
          </ParamRow>

          <ParamRow label="Brokerage commission"
            hint="Estate agent fee on the sale price">
            <PctInput value={brokeragePct} onChange={setBrokeragePct} placeholder="3.0" />
          </ParamRow>

          <ParamRow label="Registration / notary fees"
            hint="Belgian registration taxes on sale (0% if primary residence)">
            <PctInput value={registrationPct} onChange={setRegistrationPct} placeholder="0.0" />
          </ParamRow>

          <ParamRow label="Bank prepayment penalty"
            hint="Penalty on remaining loan balance (typically 3 months interest ≈ ~1-2%)">
            <PctInput value={prepaymentPct} onChange={setPrepaymentPct} placeholder="2.0" />
          </ParamRow>

        </div>
      </div>

      {/* ── Crossover insight ── */}
      {crossover ? (
        <div className="bg-violet-900/20 border border-violet-700 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-violet-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-sm text-violet-200">
            <strong>Crossover at {crossover.label}</strong> — from this point, selling in Year {saleYear} and
            reinvesting at {(reinvestRate * 100).toFixed(1)}% outperforms holding the portfolio.
          </p>
        </div>
      ) : (
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-emerald-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-sm text-emerald-200">
            <strong>Holding outperforms</strong> across the full 20-year horizon with these parameters.
            Try raising the reinvestment rate or selling earlier to find a crossover.
          </p>
        </div>
      )}

      {/* ── Comparison chart ── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-slate-100">Hold vs. Sell &amp; Reinvest</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Selling in Year {saleYear} · Reinvesting at {(reinvestRate * 100).toFixed(1)}% p.a.
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gHold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gSell" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '12px' }} />

            {/* Mark the sale year */}
            <ReferenceLine x={`+${saleYear}y`} stroke="#0ea5e9" strokeDasharray="4 3"
              label={{ value: 'Sell', fill: '#0ea5e9', fontSize: 11, position: 'insideTopRight' }} />

            <Area type="monotone" dataKey="holdValue" name="Hold"
              stroke="#10b981" strokeWidth={2.5} fill="url(#gHold)"
              dot={false} activeDot={{ r: 5, fill: '#10b981' }} />

            <Area type="monotone" dataKey="sellValue" name="Sell & Reinvest"
              stroke="#a78bfa" strokeWidth={2.5} fill="url(#gSell)"
              dot={false} activeDot={{ r: 5, fill: '#a78bfa' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Sale breakdown + comparison table */}
      <SaleBreakdown sale={sale} saleYear={saleYear} />
      <ComparisonTable data={data} saleYear={saleYear} />
    </div>
  )
}
