/**
 * PropertySimulator.jsx — Phase 8
 *
 * A "what-if" modeller for a future rental property acquisition.
 * The user inputs all parameters for the hypothetical property
 * and sees two 20-year projection overlays:
 *   • Baseline    – existing portfolio only
 *   • With New    – existing portfolio + simulated property
 *
 * Plus a "delta" table showing the incremental impact.
 *
 * Props:
 *   properties – current portfolio array
 */

import { useState, useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { simulateNewProperty, formatEUR } from '../utils/projectionUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = formatEUR

function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const AXIS_TICK = { fill: '#94a3b8', fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: 12,
}

function kFmt(v) {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v}`
}

// ─── Input field ──────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder = '0' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">€</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(num(e.target.value))}
        placeholder={placeholder}
        className="input pl-7 w-full"
      />
    </div>
  )
}

function PctInput({ value, onChange, step = '0.1' }) {
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        max="100"
        step={step}
        value={value === 0 ? '' : +(value * 100).toFixed(2)}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(isNaN(n) ? 0 : n / 100)
        }}
        placeholder="0"
        className="input pr-7 w-full"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
    </div>
  )
}

// ─── Default simulator state ──────────────────────────────────────────────────

const DEFAULT_SIM = {
  purchasePrice:         300_000,
  renovationCost:        15_000,
  currentValue:          300_000,
  appreciationRate:      0.02,
  monthlyRentalIncome:   1_200,
  indexationRate:        0.02,
  annualMaintenanceCost: 600,
  annualInsuranceCost:   400,
  annualPropertyTax:     800,
  monthlyExpenses:       100,
  inflationRate:         0.02,
  loanAmount:            240_000,
  loanInterestRate:      0.035,
  loanMonthlyPayment:    1_200,
  loanTermMonths:        240,
  acquisitionYear:       2,
  // Registration tax
  coBuying:              false,   // buying together with someone?
  mySharePct:            0.5,     // my ownership share (0–1)
  myTaxRate:             0.12,    // my registration tax rate
  partnerTaxRate:        0.02,    // partner's registration tax rate
  soloTaxRate:           0.12,    // tax rate when buying alone
  registrationTax:       0,       // computed total — updated by the UI
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function SimTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE} className="p-3 space-y-1 min-w-[180px]">
      <p className="font-semibold text-slate-200 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-xs">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-slate-200">{kFmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertySimulator({ properties }) {
  const [sim, setSim] = useState(DEFAULT_SIM)

  const set = (key) => (value) => setSim((s) => ({ ...s, [key]: value }))
  const setNum = (key) => (e) => setSim((s) => ({ ...s, [key]: num(e.target.value) }))

  // ── Registration tax calculation ──────────────────────────────────────────
  // Computed from ownership splits + per-buyer tax rates so the simulation
  // always uses the correct total even when the user changes rates mid-edit.
  const regTaxBreakdown = useMemo(() => {
    const price = sim.purchasePrice || 0
    if (sim.coBuying) {
      const myShare      = Math.max(0, Math.min(1, sim.mySharePct))
      const partnerShare = 1 - myShare
      const myTax        = price * myShare      * sim.myTaxRate
      const partnerTax   = price * partnerShare * sim.partnerTaxRate
      return { myTax, partnerTax, total: myTax + partnerTax }
    } else {
      const total = price * sim.soloTaxRate
      return { myTax: total, partnerTax: 0, total }
    }
  }, [sim.purchasePrice, sim.coBuying, sim.mySharePct, sim.myTaxRate, sim.partnerTaxRate, sim.soloTaxRate])

  // Keep sim.registrationTax in sync so projectionUtils picks it up
  const simWithTax = { ...sim, registrationTax: regTaxBreakdown.total }

  // Derive net rent yield for a quick sanity check
  const grossYield = sim.purchasePrice > 0
    ? ((sim.monthlyRentalIncome * 12) / sim.purchasePrice) * 100
    : 0

  const annualOpex =
    sim.annualMaintenanceCost + sim.annualInsuranceCost +
    sim.annualPropertyTax + sim.monthlyExpenses * 12
  const netCFYear1 =
    sim.monthlyRentalIncome * 12 -
    annualOpex -
    sim.loanMonthlyPayment * 12

  const { baseline, withNew, delta } = useMemo(
    () => simulateNewProperty(properties, simWithTax),
    // simWithTax is a derived object — depend on sim (which changes on any field edit)
    // and regTaxBreakdown.total so tax recalculates when ownership/rates change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [properties, sim, regTaxBreakdown.total]
  )

  // Chart data: merge baseline + withNew for overlay
  const chartData = baseline.map((b, i) => ({
    label: b.label,
    year:  b.year,
    baseNetWorth:    b.netWorth,
    newNetWorth:     withNew[i].netWorth,
    baseCF:          b.cumulativeCF,
    newCF:           withNew[i].cumulativeCF,
    deltaNetWorth:   delta[i].netWorth,
    deltaCF:         delta[i].cumulativeCF,
  }))

  const final20 = delta[20]
  const acqYear = sim.acquisitionYear

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Future Property Simulator</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Model a hypothetical acquisition and see its 20-year impact on your total portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Parameter panel ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Acquisition */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
              Acquisition
            </h3>
            <div className="space-y-3">
              <Field label="Purchase Price">
                <MoneyInput value={sim.purchasePrice} onChange={set('purchasePrice')} />
              </Field>
              <Field label="Renovation / Fit-out Cost" hint="One-off cash outflow in the year of purchase">
                <MoneyInput value={sim.renovationCost} onChange={set('renovationCost')} />
              </Field>
              <Field label="Initial Market Value" hint="Value after renovation (usually purchasePrice + uplift)">
                <MoneyInput value={sim.currentValue} onChange={set('currentValue')} />
              </Field>
              <Field label="Years from Today to Buy">
                <input
                  type="number"
                  min="0"
                  max="19"
                  value={sim.acquisitionYear}
                  onChange={(e) => setSim((s) => ({ ...s, acquisitionYear: parseInt(e.target.value) || 0 }))}
                  className="input w-full"
                />
              </Field>
              <Field label="Annual Appreciation">
                <PctInput value={sim.appreciationRate} onChange={set('appreciationRate')} step="0.1" />
              </Field>
            </div>
          </div>

          {/* Registration Tax */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
              Registration Tax (Registratierechten)
            </h3>
            <div className="space-y-3">
              {/* Co-buying toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Buying together with co-buyer?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sim.coBuying}
                  onClick={() => setSim((s) => ({ ...s, coBuying: !s.coBuying }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    sim.coBuying ? 'bg-brand-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      sim.coBuying ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {sim.coBuying ? (
                <>
                  <Field
                    label="My ownership share"
                    hint="Your % of the property (e.g. 50 = half-half)"
                  >
                    <PctInput value={sim.mySharePct} onChange={set('mySharePct')} step="1" />
                  </Field>
                  <Field
                    label="My tax rate"
                    hint="12% if you already own another property in Belgium"
                  >
                    <PctInput value={sim.myTaxRate} onChange={set('myTaxRate')} step="0.1" />
                  </Field>
                  <Field
                    label="Co-buyer's tax rate"
                    hint="2% klein beschrijf / reduced rate if first property"
                  >
                    <PctInput value={sim.partnerTaxRate} onChange={set('partnerTaxRate')} step="0.1" />
                  </Field>
                  {/* Breakdown */}
                  <div className="rounded-lg bg-slate-800/60 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>My share ({(sim.mySharePct * 100).toFixed(0)}% × {(sim.myTaxRate * 100).toFixed(1)}%)</span>
                      <span className="text-red-400 font-medium">{fmt(regTaxBreakdown.myTax)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Co-buyer ({((1 - sim.mySharePct) * 100).toFixed(0)}% × {(sim.partnerTaxRate * 100).toFixed(1)}%)</span>
                      <span className="text-amber-400 font-medium">{fmt(regTaxBreakdown.partnerTax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-1.5 text-slate-200 font-semibold">
                      <span>Total tax</span>
                      <span className="text-red-300">{fmt(regTaxBreakdown.total)}</span>
                    </div>
                    <p className="text-slate-500 text-xs pt-0.5">
                      The full combined tax ({fmt(regTaxBreakdown.total)}) is counted as an upfront cash outflow in the simulation.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label="Your tax rate"
                    hint="12% standard rate · 2% or 3% if this is your only property (klein beschrijf)"
                  >
                    <PctInput value={sim.soloTaxRate} onChange={set('soloTaxRate')} step="0.1" />
                  </Field>
                  <div className="rounded-lg bg-slate-800/60 p-3 text-xs flex justify-between text-slate-300">
                    <span>Total registration tax</span>
                    <span className="text-red-300 font-semibold">{fmt(regTaxBreakdown.total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rental income */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
              Rental Income
            </h3>
            <div className="space-y-3">
              <Field label="Monthly Gross Rent">
                <MoneyInput value={sim.monthlyRentalIncome} onChange={set('monthlyRentalIncome')} />
              </Field>
              <Field label="Rent Indexation Rate">
                <PctInput value={sim.indexationRate} onChange={set('indexationRate')} step="0.1" />
              </Field>
            </div>
          </div>

          {/* Operating costs */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
              Operating Costs (Annual)
            </h3>
            <div className="space-y-3">
              <Field label="Maintenance">
                <MoneyInput value={sim.annualMaintenanceCost} onChange={set('annualMaintenanceCost')} />
              </Field>
              <Field label="Insurance">
                <MoneyInput value={sim.annualInsuranceCost} onChange={set('annualInsuranceCost')} />
              </Field>
              <Field label="Property Tax">
                <MoneyInput value={sim.annualPropertyTax} onChange={set('annualPropertyTax')} />
              </Field>
              <Field label="Other Monthly Expenses">
                <MoneyInput value={sim.monthlyExpenses} onChange={set('monthlyExpenses')} />
              </Field>
              <Field label="Cost Inflation">
                <PctInput value={sim.inflationRate} onChange={set('inflationRate')} step="0.1" />
              </Field>
            </div>
          </div>

          {/* Loan */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
              Financing
            </h3>
            <div className="space-y-3">
              <Field label="Loan Amount">
                <MoneyInput value={sim.loanAmount} onChange={set('loanAmount')} />
              </Field>
              <Field label="Interest Rate">
                <PctInput value={sim.loanInterestRate} onChange={set('loanInterestRate')} step="0.05" />
              </Field>
              <Field label="Monthly Payment">
                <MoneyInput value={sim.loanMonthlyPayment} onChange={set('loanMonthlyPayment')} />
              </Field>
              <Field label="Loan Term (months)">
                <input
                  type="number"
                  min="12"
                  max="360"
                  value={sim.loanTermMonths}
                  onChange={setNum('loanTermMonths')}
                  className="input w-full"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Results panel ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Quick metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card text-center space-y-1">
              <p className="text-xs text-slate-400">Gross Yield</p>
              <p className={`text-xl font-bold ${grossYield >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {grossYield.toFixed(2)}%
              </p>
            </div>
            <div className="card text-center space-y-1">
              <p className="text-xs text-slate-400">Year-1 Net CF</p>
              <p className={`text-xl font-bold ${netCFYear1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(netCFYear1)}
              </p>
            </div>
            <div className="card text-center space-y-1">
              <p className="text-xs text-slate-400">+20y Net Worth Boost</p>
              <p className={`text-xl font-bold ${final20.netWorth >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {fmt(final20.netWorth)}
              </p>
            </div>
            <div className="card text-center space-y-1">
              <p className="text-xs text-slate-400">+20y Cumulative CF Boost</p>
              <p className={`text-xl font-bold ${final20.cumulativeCF >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {fmt(final20.cumulativeCF)}
              </p>
            </div>
          </div>

          {/* Registration tax summary banner */}
          {regTaxBreakdown.total > 0 && (
            <div className="rounded-lg border border-red-800/40 bg-red-900/10 px-4 py-3 text-xs text-slate-300 flex flex-wrap gap-x-6 gap-y-1 items-center">
              <span className="font-semibold text-red-300">Upfront registration tax</span>
              {sim.coBuying ? (
                <>
                  <span>Your share: <span className="font-medium text-red-300">{fmt(regTaxBreakdown.myTax)}</span></span>
                  <span>Co-buyer: <span className="font-medium text-amber-300">{fmt(regTaxBreakdown.partnerTax)}</span></span>
                  <span>Combined: <span className="font-semibold text-red-200">{fmt(regTaxBreakdown.total)}</span></span>
                </>
              ) : (
                <span><span className="font-semibold text-red-200">{fmt(regTaxBreakdown.total)}</span> — deducted from cash flow in year {sim.acquisitionYear > 0 ? `+${sim.acquisitionYear}` : 'now'}</span>
              )}
            </div>
          )}

          {/* Net Worth chart */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-4">
              Net Worth: Baseline vs. With New Property
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tickFormatter={kFmt} tick={AXIS_TICK} />
                <Tooltip content={<SimTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {acqYear > 0 && (
                  <ReferenceLine
                    x={`+${acqYear}y`}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Buy', fill: '#f59e0b', fontSize: 10 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="baseNetWorth"
                  name="Baseline Net Worth"
                  stroke="#64748b"
                  fill="#64748b22"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="newNetWorth"
                  name="With New Property"
                  stroke="#0ea5e9"
                  fill="#0ea5e922"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative CF chart */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-4">
              Cumulative Cash Flow: Baseline vs. With New Property
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tickFormatter={kFmt} tick={AXIS_TICK} />
                <Tooltip content={<SimTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {acqYear > 0 && (
                  <ReferenceLine
                    x={`+${acqYear}y`}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="baseCF"
                  name="Baseline Cum. CF"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="newCF"
                  name="With New Property Cum. CF"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Delta chart — incremental impact */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-1">
              Incremental Impact (New Property Alone)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              The isolated contribution of the simulated property to net worth and cumulative cash flow.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tickFormatter={kFmt} tick={AXIS_TICK} />
                <Tooltip content={<SimTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {acqYear > 0 && (
                  <ReferenceLine x={`+${acqYear}y`} stroke="#f59e0b" strokeDasharray="4 4" />
                )}
                <Bar dataKey="deltaNetWorth" name="Net Worth Impact" fill="#0ea5e9" opacity={0.7} />
                <Line
                  type="monotone"
                  dataKey="deltaCF"
                  name="Cumulative CF Impact"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Snapshot table */}
          <div className="card overflow-x-auto">
            <h3 className="text-sm font-semibold text-white mb-3">Year-by-Year Snapshot</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left pb-2 pr-3">Year</th>
                  <th className="text-right pb-2 pr-3">Baseline NW</th>
                  <th className="text-right pb-2 pr-3">With New NW</th>
                  <th className="text-right pb-2 pr-3">+NW</th>
                  <th className="text-right pb-2">+Cum CF</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 5, 7, 10, 15, 20].map((y) => {
                  const b = baseline[y]
                  const w = withNew[y]
                  const d = delta[y]
                  if (!b) return null
                  return (
                    <tr key={y} className={`border-b border-slate-700/50 ${y === acqYear ? 'bg-amber-900/10' : ''}`}>
                      <td className="py-1.5 pr-3 text-slate-300 font-medium">{b.label}</td>
                      <td className="py-1.5 pr-3 text-right text-slate-400">{fmt(b.netWorth)}</td>
                      <td className="py-1.5 pr-3 text-right text-white">{fmt(w.netWorth)}</td>
                      <td className={`py-1.5 pr-3 text-right font-semibold ${d.netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.netWorth >= 0 ? '+' : ''}{fmt(d.netWorth)}
                      </td>
                      <td className={`py-1.5 text-right font-semibold ${d.cumulativeCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.cumulativeCF >= 0 ? '+' : ''}{fmt(d.cumulativeCF)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
