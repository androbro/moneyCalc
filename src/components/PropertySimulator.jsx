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

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, AreaChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { simulateNewProperty, formatEUR } from '../utils/projectionUtils'
import InfoPopover from './InfoPopover'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = formatEUR

function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const AXIS_TICK = { fill: '#94a3b8', fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: '#e8eef6',
  border: '1px solid #b8c4d4',
  borderRadius: '12px',
  color: '#1e293b',
  fontSize: 12,
  boxShadow: '8px 8px 18px rgba(163, 177, 198, 0.45), -6px -6px 14px rgba(255, 255, 255, 0.85)',
}

function kFmt(v) {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v}`
}

// ─── Input field ──────────────────────────────────────────────────────────────

function Field({ label, hint, info, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-neo-muted flex items-center">
        {label}
        {info && <InfoPopover>{info}</InfoPopover>}
      </label>
      {children}
      {hint && <p className="text-xs text-neo-subtle">{hint}</p>}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder = '0' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neo-subtle text-sm">€</span>
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
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neo-subtle text-sm">%</span>
    </div>
  )
}

// ─── Tooltip explanation texts ────────────────────────────────────────────────

const SIM_INFO = {
  purchasePrice: (
    <>
      <strong>Purchase Price</strong> is the total amount you pay to the seller
      (notarised deed price). Registration tax and notary fees are <em>on top</em>{' '}
      of this — enter them in the Registration Tax section below.
    </>
  ),
  renovationCost: (
    <>
      <strong>Renovation / Fit-out Cost</strong> is a one-off cash outflow that
      happens in the same year you buy. It reduces your cash flow in year 1 but
      can increase the initial market value of the property.
      <br /><br />
      Typical examples: kitchen renovation, bathroom, painting, new windows.
    </>
  ),
  currentValue: (
    <>
      <strong>Initial Market Value</strong> is what the property is worth{' '}
      <em>after</em> renovation, at the moment of purchase. This is the starting
      point for annual appreciation.
      <br /><br />
      If you are buying and not renovating, set this equal to the purchase price.
      If you renovate and add value, set it higher.
    </>
  ),
  acquisitionYear: (
    <>
      <strong>Years from Today to Buy</strong> — how far in the future this
      purchase happens. Setting this to <code>0</code> means you buy immediately.
      Setting it to <code>2</code> means you buy in 2 years.
      <br /><br />
      During the waiting years the simulator keeps your baseline portfolio
      unchanged and only adds the new property from that year onward.
    </>
  ),
  appreciationRate: (
    <>
      <strong>Annual Appreciation</strong> is the expected yearly increase in
      the property's market value, expressed as a percentage.
      <br /><br />
      Belgian residential real estate has historically appreciated roughly{' '}
      <strong>3–4 %/year</strong> in cities; 2 % is a conservative assumption.
      This compounds: a €300 k property at 2 %/yr is worth ~€446 k after 20 years.
    </>
  ),
  // Registration tax
  coBuying: (
    <>
      <strong>Co-buying</strong> means you buy the property together with
      someone else, each owning a share. This matters for Belgian registration
      tax because the reduced rate for an <em>enige eigen woning</em> (sole
      primary home, currently 2 %) only applies if you do <em>not</em> already
      own another property.
      <br /><br />
      If you already own a property, your share is taxed at the full rate (12 %)
      while your co-buyer — who owns nothing else and will domicile there —
      gets the reduced rate (2 % since 01.01.2025).
    </>
  ),
  mySharePct: (
    <>
      <strong>My ownership share</strong> is your percentage of the property.
      50 % means you and your co-buyer each own half. This determines how much
      of the total price your registration tax is calculated on.
      <br /><br />
      Example: 50 % of a €400 k property = your taxable base is €200 k.
    </>
  ),
  myTaxRate: (
    <>
      <strong>My registration tax rate</strong> — the rate applied to <em>your</em>{' '}
      share of the purchase price.
      <br /><br />
      In Flanders: <strong>12 %</strong> is the standard rate. If you already
      own another property (like your apartment), you pay 12 % — no reduction
      available. If this would be your only property you could get a reduced
      rate (around 2–3 % depending on the value).
    </>
  ),
  partnerTaxRate: (
    <>
      <strong>Co-buyer's tax rate</strong> — the rate applied to your co-buyer's
      share of the purchase price.
      <br /><br />
      In Flanders: if this is your co-buyer's <em>only</em> property and they
      will domicile there within 3 years, they benefit from the{' '}
      <strong>enige eigen woning</strong> rate of <strong>2 %</strong> (since
      01.01.2025; was 3 % in 2022–2024). Otherwise the standard 12 % applies.
      Note: the old "klein beschrijf" rate-based concept no longer exists —
      the bescheiden woning benefit is now a fixed €1,867 reduction on the tax
      bill, not a different percentage.
    </>
  ),
  soloTaxRate: (
    <>
      <strong>Your registration tax rate</strong> — the percentage of the purchase
      price you owe as registration tax (verkooprecht) to the Flemish tax authority.
      <br /><br />
      In Flanders: <strong>12 %</strong> is the standard rate for any property
      that is not your sole primary home (since 01.01.2022). Because you already
      own another property, you pay 12 % — no reduction available.
      <br /><br />
      If this were your <em>only</em> home and you domicile there within 3 years,
      you could pay <strong>2 %</strong> (since 01.01.2025) with a possible extra
      reduction of €1,867 for a bescheiden woning (≤ €220k outside core cities).
    </>
  ),
  // Rental income
  monthlyRentalIncome: (
    <>
      <strong>Monthly Gross Rent</strong> is the rent you charge the tenant,
      before any costs. This is your top-line rental revenue.
      <br /><br />
      The simulator automatically indexes this rent each year by the{' '}
      <em>Rent Indexation Rate</em> below, mimicking how Belgian leases are
      typically indexed annually to the health index.
    </>
  ),
  indexationRate: (
    <>
      <strong>Rent Indexation Rate</strong> — how much rent grows each year
      as a percentage. In Belgium, residential rents are indexed annually to
      the <strong>health index</strong> (a subset of CPI), which has averaged
      roughly 2–3 %/year historically.
      <br /><br />
      This is applied automatically year-over-year on top of the base rent,
      compounding over the 20-year horizon.
    </>
  ),
  // Operating costs
  annualMaintenanceCost: (
    <>
      <strong>Annual Maintenance</strong> covers repairs and upkeep you pay
      each year as landlord: boiler servicing, fixing leaks, repainting, etc.
      <br /><br />
      A common rule of thumb is <strong>1 % of property value per year</strong>{' '}
      (so ~€3 000/yr on a €300 k property). This cost is inflation-indexed
      each year using the Cost Inflation rate.
    </>
  ),
  annualInsuranceCost: (
    <>
      <strong>Annual Insurance</strong> is the landlord's building/fire insurance
      premium. This is your responsibility as the owner — the tenant typically
      covers their own contents insurance.
      <br /><br />
      Budget roughly <strong>€200–600/year</strong> depending on the property
      size and insurer. This cost is inflation-indexed annually.
    </>
  ),
  annualPropertyTax: (
    <>
      <strong>Property Tax</strong> (<em>onroerende voorheffing</em>) is the
      annual Flemish property tax based on the indexed cadastral income (KI).
      <br /><br />
      In reality, the KI is indexed by the Flemish government every year (based
      on consumer price inflation), so the OV bill does grow over time. However,
      since this model uses a fixed user-entered amount, enter your current
      annual OV bill and be aware it will likely increase slightly each year
      in real life (modelled as fixed here for simplicity).
      <br /><br />
      As a landlord, you can contractually pass this cost on to the tenant.
    </>
  ),
  monthlyExpenses: (
    <>
      <strong>Other Monthly Expenses</strong> — a catch-all for recurring costs
      not covered above. Examples:
      <br />• Syndic fees (for apartments in a co-ownership building)
      <br />• Property management fees if you use an agency
      <br />• Small recurring maintenance contracts
      <br /><br />
      This is inflation-indexed annually.
    </>
  ),
  inflationRate: (
    <>
      <strong>Cost Inflation Rate</strong> — the annual percentage by which your
      operating costs (maintenance, insurance, other expenses) grow each year.
      <br /><br />
      This does <em>not</em> apply to the property tax (<em>onroerende
      voorheffing</em>), which stays fixed. A value of <strong>2 %</strong>{' '}
      is in line with the ECB's long-term inflation target.
    </>
  ),
  // Financing
  loanAmount: (
    <>
      <strong>Loan Amount</strong> is the mortgage principal you borrow from
      the bank to finance this property.
      <br /><br />
      The down payment is implicitly: <em>Purchase Price − Loan Amount</em>.
      For example, borrowing €240 k on a €300 k property means a €60 k down
      payment (20 %).
      <br /><br />
      Remember to also budget for registration tax and notary fees on top —
      those are typically <em>not</em> financed by the bank.
    </>
  ),
  loanInterestRate: (
    <>
      <strong>Interest Rate</strong> is the annual mortgage interest rate
      expressed as a percentage.
      <br /><br />
      Belgian fixed mortgage rates in 2024–2025 are roughly{' '}
      <strong>3–4 %</strong> depending on term and your equity ratio. A
      variable rate will fluctuate over time — use a conservative estimate
      if unsure.
    </>
  ),
  loanMonthlyPayment: (
    <>
      <strong>Monthly Payment</strong> is the fixed amount you pay to the bank
      each month, covering both interest and capital repayment
      (<em>annuity loan</em>).
      <br /><br />
      You can calculate this: for a €240 k loan at 3.5 % over 20 years, the
      monthly payment is approximately <strong>€1 392</strong>. Your bank
      statement or loan offer will show the exact figure.
    </>
  ),
  loanTermMonths: (
    <>
      <strong>Loan Term</strong> is the total duration of the mortgage in months.
      <br /><br />
      Common terms: 240 months (20 years), 300 months (25 years), 360 months
      (30 years). A longer term means lower monthly payments but more total
      interest paid. The simulator uses this to track the declining loan balance
      over 20 years.
    </>
  ),
  // Quick metrics
  grossYield: (
    <>
      <strong>Gross Yield</strong> = Annual gross rent ÷ Purchase price × 100.
      <br /><br />
      This is the <em>before-costs</em> return on the purchase price. A gross
      yield of <strong>4 %</strong> or above is generally considered decent for
      Belgian residential property. Net yield (after costs and mortgage) is
      what really matters — see Year-1 Net CF for that.
    </>
  ),
  netCF: (
    <>
      <strong>Year-1 Net Cash Flow</strong> = Annual rent − Annual operating
      costs − Annual mortgage payments.
      <br /><br />
      This is the cash you have left over (or need to top up) each year after
      paying all running costs and your mortgage. A positive number means the
      property is self-funding from day one. A negative number means you need
      to top it up from other income.
    </>
  ),
  netWorthBoost: (
    <>
      <strong>+20y Net Worth Boost</strong> — how much more net worth you have
      after 20 years <em>because</em> of this property, compared to not buying it.
      <br /><br />
      Net worth = property value − remaining loan balance. After 20 years the
      loan is largely or fully repaid and the property has appreciated, giving
      you a large equity gain.
    </>
  ),
  cumulativeCFBoost: (
    <>
      <strong>+20y Cumulative Cash Flow Boost</strong> — the total extra cash
      generated (or consumed) by this property over 20 years vs. not buying it.
      <br /><br />
      This sums up every year's net cash flow contribution from the new property.
        It can be negative in early years (mortgage {'>'} rent) and turn positive as
      rent rises and the loan balance falls.
    </>
  ),
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
      <p className="font-semibold text-neo-text/95 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-xs">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-neo-text/95">{kFmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertySimulator({ properties, onSimChange, getSimulatorProfile, saveSimulatorProfile }) {
  const [sim, setSim]         = useState(DEFAULT_SIM)
  const [simLoaded, setSimLoaded] = useState(false)
  const saveTimerRef          = useRef(null)

  // ── Load persisted state on mount ─────────────────────────────────────────
  useEffect(() => {
    getSimulatorProfile().then((saved) => {
      if (saved && Object.keys(saved).length > 0) {
        // Merge saved values over DEFAULT_SIM so any new fields added later
        // still get their defaults rather than being undefined.
        setSim((prev) => ({ ...prev, ...saved }))
      }
      setSimLoaded(true)
    }).catch(() => {
      // DB unavailable — just use defaults
      setSimLoaded(true)
    })
  }, [])

  // ── Debounced save + notify parent on every change ─────────────────────────
  useEffect(() => {
    if (!simLoaded) return   // don't save the initial DEFAULT_SIM before load completes
    if (onSimChange) onSimChange(sim)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSimulatorProfile(sim).catch(() => { /* silently ignore save errors */ })
    }, 800)
    return () => clearTimeout(saveTimerRef.current)
  }, [sim, simLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <h1 className="text-2xl font-bold text-neo-text">Future Property Simulator</h1>
        <p className="text-neo-muted text-sm mt-0.5">
          Model a hypothetical acquisition and see its 20-year impact on your total portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Parameter panel ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Acquisition */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-neo-muted uppercase tracking-wider border-b border-neo-border pb-2">
              Acquisition
            </h3>
            <div className="space-y-3">
              <Field label="Purchase Price" info={SIM_INFO.purchasePrice}>
                <MoneyInput value={sim.purchasePrice} onChange={set('purchasePrice')} />
              </Field>
              <Field label="Renovation / Fit-out Cost" info={SIM_INFO.renovationCost}>
                <MoneyInput value={sim.renovationCost} onChange={set('renovationCost')} />
              </Field>
              <Field label="Initial Market Value" info={SIM_INFO.currentValue}>
                <MoneyInput value={sim.currentValue} onChange={set('currentValue')} />
              </Field>
              <Field label="Years from Today to Buy" info={SIM_INFO.acquisitionYear}>
                <input
                  type="number"
                  min="0"
                  max="19"
                  value={sim.acquisitionYear}
                  onChange={(e) => setSim((s) => ({ ...s, acquisitionYear: parseInt(e.target.value) || 0 }))}
                  className="input w-full"
                />
              </Field>
              <Field label="Annual Appreciation" info={SIM_INFO.appreciationRate}>
                <PctInput value={sim.appreciationRate} onChange={set('appreciationRate')} step="0.1" />
              </Field>
            </div>
          </div>

          {/* Registration Tax */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-neo-muted uppercase tracking-wider border-b border-neo-border pb-2">
              Registration Tax (Registratierechten)
            </h3>
            <div className="space-y-3">
              {/* Co-buying toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neo-muted flex items-center">
                  Buying together with co-buyer?
                  <InfoPopover>{SIM_INFO.coBuying}</InfoPopover>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sim.coBuying}
                  onClick={() => setSim((s) => ({ ...s, coBuying: !s.coBuying }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    sim.coBuying ? 'bg-brand-500' : 'bg-neo-sunken'
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
                    info={SIM_INFO.mySharePct}
                  >
                    <PctInput value={sim.mySharePct} onChange={set('mySharePct')} step="1" />
                  </Field>
                  <Field
                    label="My tax rate"
                    info={SIM_INFO.myTaxRate}
                  >
                    <PctInput value={sim.myTaxRate} onChange={set('myTaxRate')} step="0.1" />
                  </Field>
                  <Field
                    label="Co-buyer's tax rate"
                    info={SIM_INFO.partnerTaxRate}
                  >
                    <PctInput value={sim.partnerTaxRate} onChange={set('partnerTaxRate')} step="0.1" />
                  </Field>
                  {/* Breakdown */}
                  <div className="rounded-lg bg-neo-sunken/70 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-neo-muted">
                      <span>My share ({(sim.mySharePct * 100).toFixed(0)}% × {(sim.myTaxRate * 100).toFixed(1)}%)</span>
                      <span className="text-red-400 font-medium">{fmt(regTaxBreakdown.myTax)}</span>
                    </div>
                    <div className="flex justify-between text-neo-muted">
                      <span>Co-buyer ({((1 - sim.mySharePct) * 100).toFixed(0)}% × {(sim.partnerTaxRate * 100).toFixed(1)}%)</span>
                      <span className="text-amber-400 font-medium">{fmt(regTaxBreakdown.partnerTax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-neo-border pt-1.5 text-neo-text/95 font-semibold">
                      <span>Total tax</span>
                      <span className="text-red-300">{fmt(regTaxBreakdown.total)}</span>
                    </div>
                    <p className="text-neo-subtle text-xs pt-0.5">
                      The full combined tax ({fmt(regTaxBreakdown.total)}) is counted as an upfront cash outflow in the simulation.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label="Your tax rate"
                    info={SIM_INFO.soloTaxRate}
                  >
                    <PctInput value={sim.soloTaxRate} onChange={set('soloTaxRate')} step="0.1" />
                  </Field>
                  <div className="rounded-lg bg-neo-sunken/70 p-3 text-xs flex justify-between text-neo-muted">
                    <span>Total registration tax</span>
                    <span className="text-red-300 font-semibold">{fmt(regTaxBreakdown.total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rental income */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-neo-muted uppercase tracking-wider border-b border-neo-border pb-2">
              Rental Income
            </h3>
            <div className="space-y-3">
              <Field label="Monthly Gross Rent" info={SIM_INFO.monthlyRentalIncome}>
                <MoneyInput value={sim.monthlyRentalIncome} onChange={set('monthlyRentalIncome')} />
              </Field>
              <Field label="Rent Indexation Rate" info={SIM_INFO.indexationRate}>
                <PctInput value={sim.indexationRate} onChange={set('indexationRate')} step="0.1" />
              </Field>
            </div>
          </div>

          {/* Operating costs */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-neo-muted uppercase tracking-wider border-b border-neo-border pb-2">
              Operating Costs (Annual)
            </h3>
            <div className="space-y-3">
              <Field label="Maintenance" info={SIM_INFO.annualMaintenanceCost}>
                <MoneyInput value={sim.annualMaintenanceCost} onChange={set('annualMaintenanceCost')} />
              </Field>
              <Field label="Insurance" info={SIM_INFO.annualInsuranceCost}>
                <MoneyInput value={sim.annualInsuranceCost} onChange={set('annualInsuranceCost')} />
              </Field>
              <Field label="Property Tax (onroerende voorheffing)" info={SIM_INFO.annualPropertyTax}>
                <MoneyInput value={sim.annualPropertyTax} onChange={set('annualPropertyTax')} />
              </Field>
              <Field label="Other Monthly Expenses" info={SIM_INFO.monthlyExpenses}>
                <MoneyInput value={sim.monthlyExpenses} onChange={set('monthlyExpenses')} />
              </Field>
              <Field label="Cost Inflation" info={SIM_INFO.inflationRate}>
                <PctInput value={sim.inflationRate} onChange={set('inflationRate')} step="0.1" />
              </Field>
            </div>
          </div>

          {/* Loan */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold text-neo-muted uppercase tracking-wider border-b border-neo-border pb-2">
              Financing
            </h3>
            <div className="space-y-3">
              <Field label="Loan Amount" info={SIM_INFO.loanAmount}>
                <MoneyInput value={sim.loanAmount} onChange={set('loanAmount')} />
              </Field>
              <Field label="Interest Rate" info={SIM_INFO.loanInterestRate}>
                <PctInput value={sim.loanInterestRate} onChange={set('loanInterestRate')} step="0.05" />
              </Field>
              <Field label="Monthly Payment" info={SIM_INFO.loanMonthlyPayment}>
                <MoneyInput value={sim.loanMonthlyPayment} onChange={set('loanMonthlyPayment')} />
              </Field>
              <Field label="Loan Term (months)" info={SIM_INFO.loanTermMonths}>
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
              <p className="text-xs text-neo-muted flex items-center justify-center">
                Gross Yield
                <InfoPopover>{SIM_INFO.grossYield}</InfoPopover>
              </p>
              <p className={`text-xl font-bold ${grossYield >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {grossYield.toFixed(2)}%
              </p>
            </div>
            <div className="card text-center space-y-1">
              <p className="text-xs text-neo-muted flex items-center justify-center">
                Year-1 Net CF
                <InfoPopover>{SIM_INFO.netCF}</InfoPopover>
              </p>
              <p className={`text-xl font-bold ${netCFYear1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(netCFYear1)}
              </p>
            </div>
            <div className="card text-center space-y-1">
              <p className="text-xs text-neo-muted flex items-center justify-center">
                +20y Net Worth Boost
                <InfoPopover>{SIM_INFO.netWorthBoost}</InfoPopover>
              </p>
              <p className={`text-xl font-bold ${final20.netWorth >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {fmt(final20.netWorth)}
              </p>
            </div>
            <div className="card text-center space-y-1">
              <p className="text-xs text-neo-muted flex items-center justify-center">
                +20y Cumulative CF Boost
                <InfoPopover>{SIM_INFO.cumulativeCFBoost}</InfoPopover>
              </p>
              <p className={`text-xl font-bold ${final20.cumulativeCF >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {fmt(final20.cumulativeCF)}
              </p>
            </div>
          </div>

          {/* Registration tax summary banner */}
          {regTaxBreakdown.total > 0 && (
            <div className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-xs text-red-900 flex flex-wrap gap-x-6 gap-y-1 items-center shadow-neo-inset-sm">
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
            <h3 className="text-sm font-semibold text-neo-text mb-4">
              Net Worth: Baseline vs. With New Property
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
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
            <h3 className="text-sm font-semibold text-neo-text mb-4">
              Cumulative Cash Flow: Baseline vs. With New Property
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
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
            <h3 className="text-sm font-semibold text-neo-text mb-1">
              Incremental Impact (New Property Alone)
            </h3>
            <p className="text-xs text-neo-subtle mb-4">
              The isolated contribution of the simulated property to net worth and cumulative cash flow.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
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
            <h3 className="text-sm font-semibold text-neo-text mb-3">Year-by-Year Snapshot</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neo-muted border-b border-neo-border">
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
                    <tr key={y} className={`border-b border-neo-border/50 ${y === acqYear ? 'bg-amber-50 shadow-neo-inset-sm' : ''}`}>
                      <td className="py-1.5 pr-3 text-neo-muted font-medium">{b.label}</td>
                      <td className="py-1.5 pr-3 text-right text-neo-muted">{fmt(b.netWorth)}</td>
                      <td className="py-1.5 pr-3 text-right text-neo-text">{fmt(w.netWorth)}</td>
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
