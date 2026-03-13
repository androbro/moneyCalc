/**
 * GrowthPlanner.jsx
 *
 * 25-year property snowball simulator and Belgian loan guide.
 *
 * Three sections:
 *   1. Position bar — current equity, surplus, available equity, borrowing power
 *   2. Acquisition roadmap — config cards + SnowballChart + milestone cards
 *   3. Acceleration advice — algorithmic advice on how to buy sooner
 *   4. Belgian Loan Guide — collapsible reference for all 7 loan types
 *
 * Props:
 *   properties  – current portfolio array (from App state)
 *   profile     – household profile { members, householdExpenses }
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { computeSummary, getRemainingBalance, formatEUR } from '../utils/projectionUtils'
import {
  simulateGrowthRoadmap,
  computeAvailableEquity,
  generateGrowthAdvice,
  calcMonthlyPayment,
  calcBulletMonthlyPayment,
} from '../calculations/growth/index.js'
import { BELGIAN_LOAN_TYPES } from '../data/belgianLoanTypes.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = formatEUR

function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const AXIS_TICK = { fill: '#94a3b8', fontSize: 11 }

function kFmt(v) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${Math.round(v)}`
}

function buildHistoricalData(properties) {
  const today = new Date()
  const purchaseDates = properties
    .map((p) => p.purchaseDate)
    .filter(Boolean)
    .map((d) => new Date(d))
  if (!purchaseDates.length) return []

  const earliest = new Date(Math.min(...purchaseDates.map((d) => d.getTime())))
  const startYear = earliest.getFullYear()
  const endYear = today.getFullYear() // "Today" point comes from simulation, stop before it

  const result = []
  for (let year = startYear; year < endYear; year++) {
    const snapDate = new Date(year, 6, 1) // mid-year snapshot for stable values
    const snapISO = snapDate.toISOString()
    const yearsFromNow = (today.getTime() - snapDate.getTime()) / (365.25 * 24 * 3600 * 1000)

    let portfolioValue = 0
    let totalDebt = 0
    for (const p of properties) {
      if (!p.purchaseDate || new Date(p.purchaseDate) > snapDate) continue
      const appRate = p.appreciationRate || 0.02
      portfolioValue += (p.currentValue || 0) / Math.pow(1 + appRate, yearsFromNow)
      for (const l of p.loans || []) {
        if (!l.startDate || new Date(l.startDate) > snapDate) continue
        try {
          totalDebt += getRemainingBalance(l, snapISO)
        } catch {
          totalDebt += l.originalAmount || 0
        }
      }
    }

    result.push({
      label: String(year),
      portfolioValue: Math.round(portfolioValue),
      totalDebt: Math.round(totalDebt),
      netWorth: Math.round(portfolioValue - totalDebt),
      monthlyCashFlow: 0,
      isHistorical: true,
    })
  }
  return result
}

function monthsToText(months) {
  if (months === null || months === undefined) return 'Not within horizon'
  if (months === 0) return 'Right now'
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y > 0) parts.push(`${y}y`)
  if (m > 0) parts.push(`${m}mo`)
  return parts.join(' ')
}

function monthYearFromNow(monthsFromNow) {
  const d = new Date()
  d.setMonth(d.getMonth() + monthsFromNow)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

const COLOR_MAP = {
  brand:   { border: 'border-brand-500/50',   badge: 'bg-brand-900/40 text-brand-300',   dot: '#3b82f6' },
  amber:   { border: 'border-amber-500/50',   badge: 'bg-amber-900/40 text-amber-300',   dot: '#f59e0b' },
  red:     { border: 'border-red-500/50',     badge: 'bg-red-900/40 text-red-300',       dot: '#ef4444' },
  emerald: { border: 'border-emerald-500/50', badge: 'bg-emerald-900/40 text-emerald-300', dot: '#10b981' },
  violet:  { border: 'border-violet-500/50',  badge: 'bg-violet-900/40 text-violet-300', dot: '#8b5cf6' },
  cyan:    { border: 'border-cyan-500/50',    badge: 'bg-cyan-900/40 text-cyan-300',     dot: '#06b6d4' },
  rose:    { border: 'border-rose-500/50',    badge: 'bg-rose-900/40 text-rose-300',     dot: '#f43f5e' },
}

function getBadgeClass(color) {
  return (COLOR_MAP[color] || COLOR_MAP.brand).badge
}

// ─── Input components ─────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder = '0', disabled = false }) {
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
        disabled={disabled}
        className="input pl-7 w-full disabled:opacity-40"
      />
    </div>
  )
}

function PctInput({ value, onChange, step = '0.1', min = 0, max = 100 }) {
  return (
    <div className="relative">
      <input
        type="number"
        min={min}
        max={max}
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

// ─── Interest rate prediction ─────────────────────────────────────────────────

/**
 * Predict Belgian mortgage rate for a given number of months from today.
 * Model: exponential decay from current rate (3.5%) towards long-run average (3.0%).
 * Half-life: 7 years. Based on ECB rate cycle history.
 */
function predictInterestRate(monthsFromNow) {
  const currentRate = 0.035
  const longRunRate = 0.030
  const halfLifeYears = 7
  const years = monthsFromNow / 12
  const decayFactor = Math.exp(-Math.LN2 * years / halfLifeYears)
  return Math.round((longRunRate + (currentRate - longRunRate) * decayFactor) * 10000) / 10000
}

/**
 * Auto-generate all achievable investment acquisitions within the horizon.
 * Uses a two-pass approach:
 * 1. Run simulation with base price queue to find trigger months
 * 2. Re-price each acquisition at the indexed price for its trigger year
 */
function generateAutoAcquisitions(properties, profile, roadmapConfig, template) {
  const {
    basePriceToday = 300000,
    priceAppreciationRate = 0.03,
    myShare = 1.0,
    strategy = 'balanced',   // 'cashflow' = bullet loans, 'balanced' = standard mortgage
    monthlyYield = 0.004,    // monthly rent as fraction of purchase price
    monthlyExpenses = 300,
  } = template

  const MAX_QUEUE = 25

  // Pass 1: run simulation with base prices to find trigger months
  const templateQueue = Array.from({ length: MAX_QUEUE }, (_, i) => ({
    label: `Investment Property ${i + 1}`,
    targetPrice: basePriceToday,
    myShare,
    isPrimaryResidence: false,
    monthlyRent: Math.round(basePriceToday * monthlyYield),
    monthlyExpenses,
    appreciationRate: 0.02,
    loanType: strategy === 'cashflow' ? 'bullet_loan' : 'hypothecaire_lening',
    loanRate: 0.035,
    loanTermYears: 20,
    acquisitionCostRate: 0.14,
  }))

  const pass1 = simulateGrowthRoadmap(properties, profile, {
    ...roadmapConfig,
    plannedAcquisitions: templateQueue,
  })

  if (!pass1.milestones.length) return []

  // Pass 2: build price-indexed acquisitions based on actual trigger months
  return pass1.milestones.map((m, i) => {
    const yearsFromNow = m.monthIndex / 12
    const indexedPrice = Math.round(basePriceToday * Math.pow(1 + priceAppreciationRate, yearsFromNow) / 5000) * 5000
    const predictedRate = predictInterestRate(m.monthIndex)
    const loanType = strategy === 'cashflow' ? 'bullet_loan' : 'hypothecaire_lening'

    return {
      id: `auto_${Date.now()}_${i}`,
      label: `Investment Property ${i + 1}`,
      targetPrice: indexedPrice,
      myShare,
      isPrimaryResidence: false,
      monthlyRent: Math.round(indexedPrice * monthlyYield),
      monthlyExpenses: Math.round(monthlyExpenses * Math.pow(1.02, yearsFromNow)),
      appreciationRate: 0.02,
      loanType,
      loanRate: predictedRate,
      loanTermYears: 20,
      acquisitionCostRate: 0.14,
    }
  })
}

// ─── Loan type recommendation modal ───────────────────────────────────────────

const PASSIVE_INCOME_RECOMMENDATION = {
  employed: 'bullet_loan',
  self_employed: 'ipt_bullet',
}

const LOAN_RECOMMENDATION_NOTES = {
  hypothecaire_lening: { score: 3, verdict: 'Good — builds equity steadily, lowest rate. Best for primary residence.' },
  hypothecair_mandaat: { score: 2, verdict: 'OK — saves upfront costs but higher rate. Good for bridge/short-term.' },
  belofte_van_hypotheek: { score: 1, verdict: 'Avoid — weakest security, highest rate, rarely accepted.' },
  bullet_loan: { score: 5, verdict: '⭐ Best for passive income (employed) — lowest monthly payment = maximum cash flow. Need exit plan at maturity.' },
  ipt_bullet: { score: 5, verdict: '⭐ Best for self-employed — company pension (IPT) repays balloon. Tax-efficient and strong cash flow.' },
  liquidatiereserve_bullet: { score: 4, verdict: 'Great for company owners — liquidation reserve at 5% tax repays balloon. Efficient exit strategy.' },
  persoonlijke_lening: { score: 1, verdict: 'Last resort only — high rate (5–8%), max €75k. Avoid for investment properties.' },
}

function LoanTypeRecommendationModal({ currentType, onSelect, onClose }) {
  const sorted = [...BELGIAN_LOAN_TYPES].sort(
    (a, b) => (LOAN_RECOMMENDATION_NOTES[b.id]?.score || 0) - (LOAN_RECOMMENDATION_NOTES[a.id]?.score || 0)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700/50 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <h2 className="text-base font-bold text-white">Choose Your Loan Type</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked for <span className="text-emerald-400 font-medium">passive income &amp; early retirement</span>. Bullet loans maximize monthly cash flow — the key to snowballing quickly.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white ml-4 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3">
          {sorted.map((lt) => {
            const note = LOAN_RECOMMENDATION_NOTES[lt.id]
            const isSelected = currentType === lt.id
            const isTop = note?.score === 5
            return (
              <div
                key={lt.id}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-brand-900/20'
                    : isTop
                    ? 'border-emerald-500/40 bg-emerald-900/10 hover:border-emerald-500/70'
                    : 'border-slate-700/50 hover:border-slate-500'
                }`}
                onClick={() => { onSelect(lt.id); onClose() }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{lt.nameEN}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getBadgeClass(lt.color)}`}>{lt.rateLabel}</span>
                      {isTop && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 font-medium">Best for passive income</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{note?.verdict}</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                      {lt.prosEN.slice(0, 2).map((p, i) => (
                        <p key={i} className="text-xs text-emerald-400/80">✓ {p}</p>
                      ))}
                      {lt.consEN.slice(0, 2).map((c, i) => (
                        <p key={i} className="text-xs text-red-400/70">✗ {c}</p>
                      ))}
                    </div>
                    {lt.monthlyPaymentStyle === 'interest_only' && (
                      <p className="text-xs text-cyan-400 mt-1.5">
                        Interest-only payment → monthly payment ~4–5× lower than annuity → maximum cash flow snowball
                      </p>
                    )}
                    <p className="text-xs text-amber-400/70 mt-1">{lt.taxNote2025}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex gap-0.5 justify-end">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full ${i < note?.score ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{lt.typicalTermYears}yr typical</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Auto-generate modal ──────────────────────────────────────────────────────

function AutoGenerateModal({ onGenerate, onClose, profile }) {
  const [basePriceToday, setBasePriceToday] = useState(300000)
  const [priceAppreciation, setPriceAppreciation] = useState(3)
  const [myShare, setMyShare] = useState(100)
  const [strategy, setStrategy] = useState('balanced')
  const [monthlyYield, setMonthlyYield] = useState(0.4)

  const currentYear = new Date().getFullYear()
  const exampleYears = [5, 10, 15]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="border-b border-slate-700/50 px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Auto-Generate Acquisitions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fills your plan with every achievable acquisition over 25 years.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white ml-4 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Base price */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">
              Base property price <span className="text-slate-500">(today, {currentYear})</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">€</span>
              <input
                type="number"
                min="50000"
                step="5000"
                value={basePriceToday}
                onChange={(e) => setBasePriceToday(num(e.target.value))}
                className="input pl-7 w-full"
              />
            </div>
          </div>

          {/* Price appreciation */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Annual property price increase</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={priceAppreciation}
                onChange={(e) => setPriceAppreciation(num(e.target.value))}
                className="input pr-7 w-full"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <div className="flex gap-2 text-xs text-slate-500 mt-1">
              {exampleYears.map((y) => (
                <span key={y} className="bg-slate-800 px-2 py-0.5 rounded">
                  +{y}y: {fmt(Math.round(basePriceToday * Math.pow(1 + priceAppreciation / 100, y) / 5000) * 5000)}
                </span>
              ))}
            </div>
          </div>

          {/* Monthly yield */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Monthly rent (% of purchase price)</label>
            <div className="relative">
              <input
                type="number"
                min="0.2"
                max="1.5"
                step="0.05"
                value={monthlyYield}
                onChange={(e) => setMonthlyYield(num(e.target.value))}
                className="input pr-7 w-full"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
            <p className="text-xs text-slate-500">
              = {fmt(Math.round(basePriceToday * monthlyYield / 100))}/mo today · {fmt(Math.round(basePriceToday * Math.pow(1 + priceAppreciation / 100, 10) * monthlyYield / 100))}/mo in 10y
            </p>
          </div>

          {/* My share */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">My ownership share</label>
            <div className="relative">
              <input type="number" min="1" max="100" step="1" value={myShare}
                onChange={(e) => setMyShare(num(e.target.value))}
                className="input pr-7 w-full" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
            </div>
          </div>

          {/* Strategy */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Loan strategy</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'balanced', label: 'Balanced', sub: 'Standard Mortgage · equity building', color: 'brand' },
                { id: 'cashflow', label: 'Max Cash Flow', sub: 'Bullet Loan · interest-only · more passive income', color: 'emerald' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    strategy === s.id
                      ? s.id === 'cashflow' ? 'border-emerald-500 bg-emerald-900/20' : 'border-brand-500 bg-brand-900/20'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <p className={`text-xs font-semibold ${strategy === s.id ? (s.id === 'cashflow' ? 'text-emerald-400' : 'text-brand-400') : 'text-white'}`}>{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                </button>
              ))}
            </div>
            {strategy === 'cashflow' && (
              <p className="text-xs text-emerald-400/80 bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-2">
                Bullet loans pay interest-only — monthly payments ~4× lower, freeing maximum cash to snowball faster. You repay the principal at loan maturity (typically via sale or refinance).
              </p>
            )}
          </div>

          {/* Interest rate note */}
          <div className="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Interest rates: ECB forward curve</p>
            <p>Today: 3.5% → converges to 3.0% over 7 years as ECB normalizes rates.</p>
            <div className="flex gap-3 mt-1">
              {[0, 36, 84, 180].map((mo) => (
                <span key={mo} className="text-slate-300">
                  +{mo === 0 ? 'now' : `${mo/12}y`}: {(predictInterestRate(mo) * 100).toFixed(2)}%
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              onGenerate({ basePriceToday, priceAppreciationRate: priceAppreciation / 100, myShare: myShare / 100, strategy, monthlyYield: monthlyYield / 100 })
              onClose()
            }}
            className="btn-primary w-full py-2.5 text-sm font-semibold"
          >
            ✨ Generate All Achievable Acquisitions
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Default acquisition template ─────────────────────────────────────────────

const DEFAULT_ACQUISITION = {
  label: 'New Investment Property',
  targetPrice: 300000,
  myShare: 1.0,
  isPrimaryResidence: false,
  monthlyRent: 1000,
  monthlyExpenses: 250,
  appreciationRate: 0.02,
  loanType: 'hypothecaire_lening',
  loanRate: 0.035,
  loanTermYears: 20,
  acquisitionCostRate: 0.14,
}

function normalizeAcquisition(raw, index) {
  return {
    ...DEFAULT_ACQUISITION,
    ...raw,
    id: raw?.id || `acq_${index + 1}`,
  }
}

function buildPlanSnapshot(acquisitions, horizonYears, maxLTV) {
  return {
    acquisitions: acquisitions.map((acq, idx) => normalizeAcquisition(acq, idx)),
    horizonYears,
    maxLTV,
  }
}

// ─── Position Bar ─────────────────────────────────────────────────────────────

function MetricTile({ label, value, color, subtitle }) {
  return (
    <div className="text-center p-1">
      <p className="text-xs text-slate-400 leading-tight">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{fmt(value)}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function PositionBar({ properties, profile }) {
  const summary = useMemo(() => computeSummary(properties, profile), [properties, profile])
  const availableEquity = useMemo(
    () => computeAvailableEquity(properties, new Date().toISOString()),
    [properties]
  )

  const totalMemberIncome = (profile.members || []).reduce(
    (s, m) => s + (m.netIncome || 0) + (m.investmentIncome || 0),
    0
  )
  const monthlyRentalNetCF = summary.totalMonthlyCashFlow || 0
  const totalLoanPayments = properties.reduce(
    (s, p) =>
      s +
      (p.loans || []).reduce((ls, l) => ls + (l.monthlyPayment || 0), 0),
    0
  )
  const monthlySurplus = Math.max(
    0,
    totalMemberIncome - (profile.householdExpenses || 0) - totalLoanPayments + monthlyRentalNetCF
  )

  const borrowingPower = Math.max(0, summary.totalNetWorth * 0.8)

  return (
    <div className="card grid grid-cols-2 sm:grid-cols-4 gap-3 mb-0">
      <MetricTile
        label="Portfolio Equity"
        value={summary.totalNetWorth || 0}
        color="text-brand-400"
        subtitle="Current net worth"
      />
      <MetricTile
        label="Monthly Surplus"
        value={monthlySurplus}
        color={monthlySurplus >= 0 ? 'text-emerald-400' : 'text-red-400'}
        subtitle="After all costs & loans"
      />
      <MetricTile
        label="Available Equity"
        value={availableEquity}
        color="text-amber-400"
        subtitle="80% LTV − debt"
      />
      <MetricTile
        label="Est. Borrowing Power"
        value={borrowingPower}
        color="text-violet-400"
        subtitle="Approx. 80% of equity"
      />
    </div>
  )
}

// ─── Acquisition Config Card ──────────────────────────────────────────────────

function LoanTypePill({ loanTypeId }) {
  const lt = BELGIAN_LOAN_TYPES.find((t) => t.id === loanTypeId)
  if (!lt) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBadgeClass(lt.color)}`}>
      {lt.nameEN}
    </span>
  )
}

function AcquisitionConfigCard({ acquisition, index, milestone, isExpanded, onToggle, onChange, onRemove, onOpenLoanModal }) {
  const isBullet =
    acquisition.loanType === 'bullet_loan' ||
    acquisition.loanType === 'ipt_bullet' ||
    acquisition.loanType === 'liquidatiereserve_bullet'

  const loanAmount = acquisition.targetPrice * (acquisition.isPrimaryResidence ? 0.90 : 0.80) * acquisition.myShare
  const termMonths = acquisition.loanTermYears * 12
  const monthlyPayment = isBullet
    ? calcBulletMonthlyPayment(loanAmount, acquisition.loanRate)
    : calcMonthlyPayment(loanAmount, acquisition.loanRate, termMonths)
  const milestoneLabel = milestone
    ? `+${milestone.year}y (${monthYearFromNow(milestone.monthIndex)})`
    : 'Not within horizon'

  function update(key, value) {
    const updated = { ...acquisition, [key]: value }
    // Auto-adjust acquisition cost rate when primary residence changes
    if (key === 'isPrimaryResidence') {
      updated.acquisitionCostRate = value ? 0.04 : 0.14
    }
    // Auto-populate rate from loan type default
    if (key === 'loanType') {
      const lt = BELGIAN_LOAN_TYPES.find((t) => t.id === value)
      if (lt) updated.loanRate = lt.rateRange.min
    }
    onChange(updated)
  }

  return (
    <div className="card border border-slate-700/50">
      {/* Header (always visible) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{acquisition.label || 'Unnamed'}</p>
            <p className="text-xs text-slate-400">
              {fmt(acquisition.targetPrice)} · <span className={milestone ? 'text-amber-400' : 'text-slate-500'}>{milestoneLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LoanTypePill loanTypeId={acquisition.loanType} />
          <ChevronIcon open={isExpanded} />
        </div>
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-slate-700/50 pt-4">
          {/* Label */}
          <Field label="Label">
            <input
              type="text"
              value={acquisition.label}
              onChange={(e) => update('label', e.target.value)}
              className="input w-full"
              placeholder="e.g. New House, Rental Apartment"
            />
          </Field>

          {/* Primary residence toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">Primary Residence</label>
            <button
              onClick={() => update('isPrimaryResidence', !acquisition.isPrimaryResidence)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                acquisition.isPrimaryResidence ? 'bg-brand-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  acquisition.isPrimaryResidence ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {acquisition.isPrimaryResidence && (
            <p className="text-xs text-amber-400/80 -mt-2">
              Primary residence: 90% LTV, ~4% acquisition costs (verlaagd tarief) · <span className="text-slate-500">loan excluded from CF chart</span>
            </p>
          )}

          {/* Price + share */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Price">
              <MoneyInput value={acquisition.targetPrice} onChange={(v) => update('targetPrice', v)} />
            </Field>
            <Field label="My Share %" hint="50% for joint purchase">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={Math.round(acquisition.myShare * 100)}
                  onChange={(e) => update('myShare', Math.max(0.01, Math.min(1, num(e.target.value) / 100)))}
                  className="input pr-7 w-full"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
            </Field>
          </div>

          {/* Rent + expenses */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly Rent" hint={acquisition.isPrimaryResidence ? 'Not applicable' : ''}>
              <MoneyInput
                value={acquisition.monthlyRent}
                onChange={(v) => update('monthlyRent', v)}
                disabled={acquisition.isPrimaryResidence}
              />
            </Field>
            <Field label="Monthly Expenses" hint="Insurance, maintenance, etc.">
              <MoneyInput value={acquisition.monthlyExpenses} onChange={(v) => update('monthlyExpenses', v)} />
            </Field>
          </div>

          {/* Appreciation + acquisition cost */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual Appreciation">
              <PctInput value={acquisition.appreciationRate} onChange={(v) => update('appreciationRate', v)} />
            </Field>
            <Field label="Acquisition Costs" hint="Registration tax + notary">
              <PctInput value={acquisition.acquisitionCostRate} onChange={(v) => update('acquisitionCostRate', v)} />
            </Field>
          </div>

          {/* Loan type */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-400">Loan Type</label>
              <button
                onClick={() => onOpenLoanModal && onOpenLoanModal()}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Which type? →
              </button>
            </div>
            <select
              value={acquisition.loanType}
              onChange={(e) => update('loanType', e.target.value)}
              className="input w-full"
            >
              {BELGIAN_LOAN_TYPES.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.nameEN} ({lt.rateLabel})
                </option>
              ))}
            </select>
          </div>
          {isBullet && (
            <p className="text-xs text-emerald-400/80 -mt-2">
              Interest-only: monthly payment ≈ {fmt(monthlyPayment)}/mo — capital repaid at maturity
            </p>
          )}

          {/* Rate + term */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Interest Rate">
              <PctInput value={acquisition.loanRate} onChange={(v) => update('loanRate', v)} step="0.05" />
            </Field>
            <Field label="Loan Term (years)">
              <input
                type="number"
                min="5"
                max="30"
                step="1"
                value={acquisition.loanTermYears}
                onChange={(e) => update('loanTermYears', Math.max(5, num(e.target.value)))}
                className="input w-full"
              />
            </Field>
          </div>

          {/* Payment summary */}
          {(() => {
            const ltv = acquisition.isPrimaryResidence ? 0.90 : 0.80
            const downPayment = acquisition.targetPrice * acquisition.myShare * (1 - ltv)
            const acqCosts = acquisition.targetPrice * acquisition.acquisitionCostRate * acquisition.myShare
            const requiredOwn = Math.max(0, downPayment + acqCosts)
            return (
              <div className="rounded-lg bg-slate-800/50 p-3 space-y-1">
                <p className="text-xs text-slate-400 font-medium">Loan summary</p>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Loan amount ({Math.round(ltv * acquisition.myShare * 100)}% LTV)</span>
                  <span className="text-white font-semibold">{fmt(loanAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Monthly payment</span>
                  <span className="text-emerald-400 font-semibold">{fmt(monthlyPayment)}/mo</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1 mt-1">
                  <span className="text-slate-500">Own funds breakdown:</span>
                </div>
                <div className="flex justify-between text-xs pl-2">
                  <span className="text-slate-400">↳ Down payment ({Math.round((1 - ltv) * 100)}%)</span>
                  <span className="text-white">{fmt(downPayment)}</span>
                </div>
                <div className="flex justify-between text-xs pl-2">
                  <span className="text-slate-400">↳ Acquisition costs ({Math.round(acquisition.acquisitionCostRate * 100)}%)</span>
                  <span className="text-white">{fmt(acqCosts)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1 mt-1">
                  <span className="text-slate-400 font-medium">Required own funds</span>
                  <span className="text-amber-400 font-semibold">{fmt(requiredOwn)}</span>
                </div>
              </div>
            )
          })()}

          {/* Remove button */}
          <button
            onClick={onRemove}
            className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
          >
            Remove this acquisition
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Snowball Chart ───────────────────────────────────────────────────────────

function SnowballTooltip({ active, payload, label, milestones }) {
  if (!active || !payload?.length) return null
  const matchingMilestones = milestones.filter((m) => `+${m.year}y` === label || (label === 'Today' && m.year === 0))
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-xs min-w-[200px]">
      <p className="font-semibold text-white mb-2 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="font-medium flex items-center gap-1.5" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-white font-semibold">
            {entry.dataKey === 'monthlyCashFlow' ? `€${Math.round(entry.value)}/mo` : kFmt(entry.value)}
          </span>
        </div>
      ))}
      {matchingMilestones.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-600">
          {matchingMilestones.length === 1 ? (
            <>
              <p className="text-amber-400 font-semibold">🏠 {matchingMilestones[0].label}</p>
              <p className="text-slate-400">Own funds: {fmt(matchingMilestones[0].cashUsed)}</p>
              <p className="text-slate-400">New loan: {fmt(matchingMilestones[0].newLoanAmount)}</p>
            </>
          ) : (
            <>
              <p className="text-amber-400 font-semibold">🏠 {matchingMilestones.length} acquisitions this year</p>
              {matchingMilestones.map((m, idx) => (
                <p key={`${m.monthIndex}_${idx}`} className="text-slate-400 truncate">
                  #{idx + 1}: {m.label} ({monthYearFromNow(m.monthIndex)})
                </p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SnowballChart({ yearlyData, milestones, historicalData, properties }) {
  if (!yearlyData.length) return null

  const combinedData = [...historicalData, ...yearlyData]
  const validLabels = new Set(combinedData.map((d) => d.label))
  const tickInterval = Math.max(1, Math.floor(combinedData.length / 10))
  const xTicks = combinedData
    .map((d) => d.label)
    .filter((lbl, idx, arr) => idx % tickInterval === 0 || idx === arr.length - 1)

  const currentYear = new Date().getFullYear()

  // Owned properties → blue reference lines at their historical purchase year
  const ownedPurchaseYears = [...new Set(
    properties
      .filter((p) => p.status !== 'planned')
      .map((p) => p.purchaseDate && new Date(p.purchaseDate).getFullYear())
      .filter(Boolean)
  )]

  // Planned properties → amber reference lines mapped to "Today" (current year) or "+Xy"
  const plannedMarkers = properties
    .filter((p) => p.status === 'planned' && p.purchaseDate)
    .map((p) => {
      const yr = new Date(p.purchaseDate).getFullYear()
      const diff = yr - currentYear
      return {
        name: p.name || p.address || 'Planned',
        label: diff <= 0 ? 'Today' : `+${diff}y`,
      }
    })

  const firstYear = historicalData.length ? historicalData[0].label : 'Today'
  const horizonY = yearlyData.length - 1

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">
        Portfolio Growth ({firstYear} → +{horizonY}y)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={combinedData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={AXIS_TICK} interval={0} ticks={xTicks} />
          <YAxis yAxisId="left" tickFormatter={kFmt} tick={AXIS_TICK} width={60} />
          <YAxis yAxisId="cf" orientation="right" tickFormatter={(v) => `€${Math.round(v)}`} tick={AXIS_TICK} width={60} />
          <Tooltip content={<SnowballTooltip milestones={milestones} />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="portfolioValue"
            name="Portfolio Value"
            fill="#1e3a5f"
            stroke="#3b82f6"
            strokeWidth={2}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="netWorth"
            name="Net Worth"
            fill="#052e16"
            stroke="#10b981"
            strokeWidth={2}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="totalDebt"
            name="Total Debt"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            yAxisId="cf"
            type="monotone"
            dataKey="monthlyCashFlow"
            name="Monthly Cash Flow"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
          />
          {/* Owned property acquisitions — blue lines */}
          {ownedPurchaseYears.map((yr) => {
            const lbl = String(yr)
            if (!validLabels.has(lbl)) return null
            return (
              <ReferenceLine
                key={`hist_${yr}`}
                yAxisId="left"
                x={lbl}
                stroke="#3b82f6"
                strokeDasharray="4 2"
                label={{ value: `${yr}`, position: 'insideTopRight', fill: '#60a5fa', fontSize: 10, fontWeight: 'bold' }}
              />
            )
          })}
          {/* Planned (not yet owned) property acquisitions — violet lines */}
          {plannedMarkers.map((pm) => {
            if (!validLabels.has(pm.label)) return null
            return (
              <ReferenceLine
                key={`planned_${pm.label}_${pm.name}`}
                yAxisId="left"
                x={pm.label}
                stroke="#a78bfa"
                strokeDasharray="4 2"
                label={{ value: pm.name.slice(0, 8), position: 'insideTopRight', fill: '#c4b5fd', fontSize: 10, fontWeight: 'bold' }}
              />
            )
          })}
          {/* Simulation milestones — group same-year acquisitions into one labelled marker */}
          {(() => {
            const groups = new Map()
            milestones.forEach((m, idx) => {
              const xLabel = m.year === 0 ? 'Today' : `+${m.year}y`
              if (!groups.has(xLabel)) groups.set(xLabel, [])
              groups.get(xLabel).push({ milestone: m, index: idx + 1 })
            })

            return Array.from(groups.entries()).map(([xLabel, items]) => {
              if (!validLabels.has(xLabel)) return null
              const firstIdx = items[0].index
              const lastIdx = items[items.length - 1].index
              const markerLabel = items.length === 1 ? `#${firstIdx}` : `#${firstIdx}-${lastIdx}`
              return (
                <ReferenceLine
                  key={`milestone_${xLabel}_${firstIdx}_${lastIdx}`}
                  yAxisId="left"
                  x={xLabel}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                  label={{ value: markerLabel, position: 'insideTopRight', fill: '#fbbf24', fontSize: 10, fontWeight: 'bold' }}
                />
              )
            })
          })()}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Milestone Cards ──────────────────────────────────────────────────────────

function MilestoneCard({ milestone, index }) {
  const lt = BELGIAN_LOAN_TYPES.find((t) => t.id === milestone.recommendedLoanType)
  const color = lt?.color || 'brand'

  return (
    <div
      className={`card space-y-3 border-l-4 ${(COLOR_MAP[color] || COLOR_MAP.brand).border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Acquisition {index + 1}</span>
        <span className="text-xs font-semibold text-amber-400">
          {(() => {
            if (milestone.monthIndex === 0) return `Now (${monthYearFromNow(0)})`
            return `+${milestone.year}y (${monthYearFromNow(milestone.monthIndex)})`
          })()}
        </span>
      </div>
      <p className="font-semibold text-white text-sm leading-tight">{milestone.label}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Property (my share)</span>
          <span className="text-white font-semibold">{fmt(milestone.mySharePrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Own funds needed</span>
          <span className="text-amber-400 font-semibold">{fmt(milestone.cashUsed)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">New loan</span>
          <span className="text-slate-300">{fmt(milestone.newLoanAmount)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Monthly payment</span>
          <span className={milestone.isBullet ? 'text-emerald-400' : 'text-slate-300'}>
            {fmt(milestone.monthlyPayment)}/mo
            {milestone.isBullet && ' (interest only)'}
          </span>
        </div>
      </div>
      {/* Portfolio after acquisition */}
      <div className="rounded bg-slate-800/50 p-2 space-y-0.5">
        <p className="text-xs text-slate-500 font-medium">After acquisition</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Net worth</span>
          <span className="text-emerald-400 font-semibold">{fmt(milestone.portfolioSnapshot.netWorth)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Properties</span>
          <span className="text-white">{milestone.portfolioSnapshot.propertyCount}</span>
        </div>
      </div>
      <LoanTypePill loanTypeId={milestone.recommendedLoanType} />
    </div>
  )
}

// ─── Unified Timeline (existing + planned) ────────────────────────────────────

function ExistingPropertyCard({ property }) {
  const today = new Date().toISOString()
  const isPlanned = property.status === 'planned'
  const debt = (property.loans || []).reduce((s, l) => {
    try { return s + getRemainingBalance(l, today) }
    catch { return s + (l.originalAmount || 0) }
  }, 0)
  const equity = (property.currentValue || 0) - debt
  const purchaseYear = property.purchaseDate
    ? new Date(property.purchaseDate).getFullYear()
    : '?'
  const isRented = property.status === 'rented' || property.isRented === true || (property.startRentalIncome || 0) > 0
  const statusLabel = isPlanned ? 'Planned' :
    property.status === 'rented' ? 'Rented out' :
    property.status === 'owner_occupied' ? 'Owner-occupied' :
    property.isRented ? 'Rented' : 'Owned'
  const statusColor = isPlanned ? 'text-amber-400' : isRented ? 'text-brand-400' : 'text-slate-400'
  const borderColor = isPlanned ? 'border-amber-500/50' : isRented ? 'border-brand-500/50' : 'border-slate-600/50'

  return (
    <div className={`card space-y-3 border-l-4 ${borderColor}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {isPlanned ? `Planned ${purchaseYear}` : `Purchased ${purchaseYear}`}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
          {!isRented && debt > 0 && (
            <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">loan excluded from CF</span>
          )}
        </div>
      </div>
      <p className="font-semibold text-white text-sm leading-tight">
        {property.name || property.address || 'Property'}
      </p>
      <div className="space-y-1">
        {property.purchasePrice > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Purchase price</span>
            <span className="text-slate-300">{fmt(property.purchasePrice)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Current value</span>
          <span className="text-white font-semibold">{fmt(property.currentValue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Remaining debt</span>
          <span className="text-red-400">{fmt(debt)}</span>
        </div>
        <div className="flex justify-between text-xs border-t border-slate-700/40 pt-1">
          <span className="text-slate-400 font-medium">Equity</span>
          <span className="text-emerald-400 font-semibold">{fmt(equity)}</span>
        </div>
      </div>
    </div>
  )
}


// ─── Acceleration Advice ──────────────────────────────────────────────────────

const ADVICE_COLOR_CLASSES = {
  emerald: 'border-emerald-500/50 bg-emerald-900/10',
  brand:   'border-brand-500/50 bg-brand-900/10',
  amber:   'border-amber-500/50 bg-amber-900/10',
  violet:  'border-violet-500/50 bg-violet-900/10',
  cyan:    'border-cyan-500/50 bg-cyan-900/10',
}

function AdviceCard({ item }) {
  const colorClass = ADVICE_COLOR_CLASSES[item.color] || ADVICE_COLOR_CLASSES.brand
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${colorClass}`}>
      <span className="text-xl shrink-0">{item.icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-white text-sm">{item.title}</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
        {item.isImmediate && (
          <p className="text-xs text-emerald-400 font-semibold mt-1.5">→ You can buy right now</p>
        )}
        {!item.isImmediate && item.monthsSaved > 0 && (
          <p className="text-xs text-emerald-400 mt-1.5">
            → Saves <span className="font-semibold">{item.monthsSaved} months</span>
            {item.monthlyImpact > 0 && ` (+${fmt(item.monthlyImpact)}/mo)`}
          </p>
        )}
      </div>
    </div>
  )
}

function AccelerationAdvice({ advice, baseReadyInMonths }) {
  const hasAdvice = advice.length > 0
  const canBuyNow = baseReadyInMonths === 0

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Ways to Accelerate</h2>
        {canBuyNow ? (
          <p className="text-emerald-400 text-sm mt-1 font-medium">
            You have enough to start your first acquisition right now.
          </p>
        ) : baseReadyInMonths !== null ? (
          <p className="text-slate-400 text-sm mt-1">
            Your first acquisition is ready in{' '}
            <span className="text-white font-semibold">{monthsToText(baseReadyInMonths)}</span>.
            Here are concrete ways to get there sooner:
          </p>
        ) : (
          <p className="text-slate-400 text-sm mt-1">
            No acquisition is reachable in the current horizon. These steps could change that:
          </p>
        )}
      </div>
      {hasAdvice ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {advice.map((item) => (
            <AdviceCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm">
          No specific recommendations available. Add a planned acquisition above to see opportunities.
        </p>
      )}
    </div>
  )
}

// ─── Belgian Loan Guide ───────────────────────────────────────────────────────

function LoanGuideCard({ loanType, expanded, onToggle }) {
  const colors = COLOR_MAP[loanType.color] || COLOR_MAP.brand
  return (
    <div className={`rounded-xl border p-4 space-y-3 cursor-pointer transition-colors hover:border-slate-500 ${colors.border}`}>
      <button onClick={onToggle} className="w-full text-left space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-white text-sm">{loanType.nameEN}</p>
            <p className="text-xs text-slate-400">{loanType.nameNL}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${colors.badge}`}>
            {loanType.rateLabel}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{loanType.summaryEN}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{expanded ? '▲ Less' : '▼ More'}</span>
          {loanType.taxDeductible && (
            <span className="text-violet-400 font-medium">★ Tax deductible</span>
          )}
          {loanType.monthlyPaymentStyle === 'interest_only' && (
            <span className="text-emerald-400">↓ Low monthly</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-700/50 pt-3">
          {/* Pros */}
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-1">Advantages</p>
            <ul className="space-y-0.5">
              {loanType.prosEN.map((p) => (
                <li key={p} className="text-xs text-slate-300 flex gap-1.5">
                  <span className="text-emerald-500 shrink-0">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          {/* Cons */}
          <div>
            <p className="text-xs font-semibold text-red-400 mb-1">Disadvantages</p>
            <ul className="space-y-0.5">
              {loanType.consEN.map((c) => (
                <li key={c} className="text-xs text-slate-300 flex gap-1.5">
                  <span className="text-red-500 shrink-0">✗</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          {/* 2025 tax note */}
          <div className="rounded bg-amber-950/40 border border-amber-700/30 p-2">
            <p className="text-xs text-amber-300 font-semibold">2025 Tax Note</p>
            <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">{loanType.taxNote2025}</p>
          </div>
          {/* Details */}
          <div className="flex flex-wrap gap-2 text-xs">
            {loanType.typicalLTV && (
              <span className="bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">
                LTV: {Math.round(loanType.typicalLTV * 100)}%
              </span>
            )}
            <span className="bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">
              Term: {loanType.typicalTermYears}y typical
            </span>
            <span className="bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">
              {loanType.monthlyPaymentStyle === 'interest_only' ? 'Interest only' : 'Annuity (capital + interest)'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function LoanGuide({ expandedCard, onToggleCard }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card space-y-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-white">Belgian Loan Guide</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            7 financing options for Belgian real estate — including 2025 tax changes
          </p>
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
          {BELGIAN_LOAN_TYPES.map((lt) => (
            <LoanGuideCard
              key={lt.id}
              loanType={lt}
              expanded={expandedCard === lt.id}
              onToggle={() => onToggleCard(lt.id === expandedCard ? null : lt.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GrowthPlanner({ properties, profile, initialPlan, onSavePlan }) {
  const initialSnapshot = useMemo(() => {
    const incoming = Array.isArray(initialPlan?.acquisitions) && initialPlan.acquisitions.length > 0
      ? initialPlan.acquisitions
      : [{ ...DEFAULT_ACQUISITION, id: '1' }]
    return buildPlanSnapshot(
      incoming,
      Number(initialPlan?.horizonYears ?? 25),
      Number(initialPlan?.maxLTV ?? 0.8)
    )
  }, [initialPlan])

  const [acquisitions, setAcquisitions] = useState(initialSnapshot.acquisitions)
  const [expandedIdx, setExpandedIdx] = useState(0)
  const [expandedLoanCard, setExpandedLoanCard] = useState(null)
  const [horizonYears, setHorizonYears] = useState(initialSnapshot.horizonYears)
  const [horizonYearsInput, setHorizonYearsInput] = useState(String(initialSnapshot.horizonYears))
  const [maxLTV, setMaxLTV] = useState(initialSnapshot.maxLTV)
  const [showAutoModal, setShowAutoModal] = useState(false)
  const [loanRecommendModal, setLoanRecommendModal] = useState(null) // index of acquisition
  const lastPersistedRef = useRef(JSON.stringify(initialSnapshot))

  function persistPlan(snapshot) {
    if (!onSavePlan) return
    const serialized = JSON.stringify(snapshot)
    if (serialized === lastPersistedRef.current) return
    onSavePlan(snapshot)
    lastPersistedRef.current = serialized
  }

  useEffect(() => {
    setAcquisitions(initialSnapshot.acquisitions)
    setHorizonYears(initialSnapshot.horizonYears)
    setHorizonYearsInput(String(initialSnapshot.horizonYears))
    setMaxLTV(initialSnapshot.maxLTV)
    setExpandedIdx((idx) => {
      const lastIndex = Math.max(0, initialSnapshot.acquisitions.length - 1)
      if (idx > lastIndex) return lastIndex
      return idx
    })
    lastPersistedRef.current = JSON.stringify(initialSnapshot)
  }, [initialSnapshot])

  useEffect(() => {
    if (!onSavePlan) return
    const snapshot = buildPlanSnapshot(acquisitions, horizonYears, maxLTV)
    if (JSON.stringify(snapshot) === lastPersistedRef.current) return

    const timer = setTimeout(() => {
      persistPlan(snapshot)
    }, 400)

    return () => clearTimeout(timer)
  }, [acquisitions, horizonYears, maxLTV, onSavePlan])

  // Exclude planned/simulated properties — they aren't owned yet and would skew the simulation
  const realProperties = useMemo(
    () => properties.filter((p) => p.status !== 'planned'),
    [properties]
  )

  const startingCash = useMemo(
    () => (profile.members || []).reduce((s, m) => s + (m.cash || 0), 0),
    [profile]
  )

  const roadmapConfig = useMemo(
    () => ({
      horizonYears,
      plannedAcquisitions: acquisitions,
      maxLTV,
      startingCash,
      incomeSavingsBuffer: 0.10,
    }),
    [horizonYears, acquisitions, maxLTV, startingCash]
  )

  // Historical chart: only real owned properties (not planned future purchases)
  const historicalData = useMemo(() => buildHistoricalData(realProperties), [realProperties])

  // Simulation uses ALL properties — planned ones carry real loan costs that affect monthly surplus
  const roadmap = useMemo(
    () => simulateGrowthRoadmap(properties, profile, roadmapConfig),
    [properties, profile, roadmapConfig]
  )

  const advice = useMemo(
    () => generateGrowthAdvice(properties, profile, roadmapConfig, roadmap.summary.readyInMonths),
    [properties, profile, roadmapConfig, roadmap.summary.readyInMonths]
  )

  function addAcquisition() {
    const id = String(Date.now())
    setAcquisitions((prev) => [
      ...prev,
      { ...DEFAULT_ACQUISITION, label: `Investment Property ${prev.length + 1}`, id },
    ])
    setExpandedIdx(acquisitions.length)
  }

  function updateAcquisition(idx, updated) {
    setAcquisitions((prev) => prev.map((a, i) => (i === idx ? updated : a)))
  }

  function removeAcquisition(idx) {
    setAcquisitions((prev) => prev.filter((_, i) => i !== idx))
    setExpandedIdx((e) => (e >= idx ? Math.max(0, e - 1) : e))
  }

  function handleAutoGenerate(template) {
    const generated = generateAutoAcquisitions(properties, profile, roadmapConfig, template)
    if (generated.length > 0) {
      setAcquisitions(generated)
      setExpandedIdx(null)
    }
  }

  function commitHorizonInput(raw) {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setHorizonYearsInput(String(horizonYears))
      return
    }
    const clamped = Math.min(40, Math.max(5, Math.round(parsed)))
    setHorizonYears(clamped)
    setHorizonYearsInput(String(clamped))
    persistPlan(buildPlanSnapshot(acquisitions, clamped, maxLTV))
  }

  const { milestones, yearlyData, summary } = roadmap

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Growth Planner</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Simulate your property snowball over {horizonYears} years — and discover how to accelerate it.
        </p>
      </div>

      {/* Position bar */}
      <PositionBar properties={realProperties} profile={profile} />

      {/* Summary strip */}
      {summary.totalProperties > properties.length && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card text-center">
            <p className="text-xs text-slate-400">First acquisition ready</p>
            <p className="text-base font-bold text-amber-400">{monthsToText(summary.readyInMonths)}</p>
            {summary.readyInMonths !== null && (
              <p className="text-xs text-slate-500">{monthYearFromNow(summary.readyInMonths)}</p>
            )}
          </div>
          <div className="card text-center">
            <p className="text-xs text-slate-400">Properties in {horizonYears}y</p>
            <p className="text-base font-bold text-white">{summary.totalProperties}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-slate-400">Final net worth</p>
            <p className="text-base font-bold text-emerald-400">{fmt(summary.finalNetWorth)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-slate-400">Monthly CF at year {horizonYears}</p>
            <p className="text-base font-bold text-emerald-400">{fmt(summary.finalMonthlyCF)}/mo</p>
          </div>
        </div>
      )}

      {/* Portfolio growth chart — full width */}
      <div className="card">
        <SnowballChart
          yearlyData={yearlyData}
          milestones={milestones}
          historicalData={historicalData}
          properties={properties}
        />
      </div>

      {/* Unified property journey */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Property Journey</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAutoModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50 transition-colors font-medium"
            >
              ✨ Auto-generate
            </button>
            <button onClick={addAcquisition} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <PlusIcon />
              Add
            </button>
          </div>
        </div>

        {/* Existing properties (read-only) */}
        {[...properties]
          .sort((a, b) => new Date(a.purchaseDate || 0) - new Date(b.purchaseDate || 0))
          .map((p) => (
            <ExistingPropertyCard key={p.id} property={p} />
          ))}

        {/* Divider between existing and planned */}
        {properties.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">planned acquisitions ↓</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
        )}

        {/* Planned acquisition config cards */}
        {acquisitions.length === 0 ? (
          <div className="card text-center py-8 text-slate-500 text-sm">
            No planned acquisitions yet. Add one to see the snowball.
          </div>
        ) : (
          acquisitions.map((acq, idx) => (
            <AcquisitionConfigCard
              key={acq.id || idx}
              acquisition={acq}
              index={idx}
              milestone={milestones[idx]}
              isExpanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? -1 : idx)}
              onChange={(updated) => updateAcquisition(idx, updated)}
              onRemove={() => removeAcquisition(idx)}
              onOpenLoanModal={() => setLoanRecommendModal(idx)}
            />
          ))
        )}

        {/* Simulation settings */}
        <div className="card space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Simulation Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Horizon (years)">
              <input
                type="number"
                min="5"
                max="40"
                step="1"
                value={horizonYearsInput}
                onChange={(e) => {
                  const raw = e.target.value
                  setHorizonYearsInput(raw)
                  if (raw === '') return
                  const parsed = Number(raw)
                  if (Number.isFinite(parsed) && parsed > 0) setHorizonYears(Math.round(parsed))
                }}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  if (raw === '') {
                    setHorizonYearsInput(String(horizonYears))
                    return
                  }
                  commitHorizonInput(raw)
                }}
                className="input w-full"
              />
            </Field>
            <Field label="Max LTV" hint="Typically 80% for investment">
              <PctInput value={maxLTV} onChange={setMaxLTV} step="1" min={50} max={100} />
            </Field>
          </div>
        </div>
      </div>

      {/* Acceleration advice */}
      <AccelerationAdvice advice={advice} baseReadyInMonths={summary.readyInMonths} />

      {/* Belgian Loan Guide */}
      <LoanGuide
        expandedCard={expandedLoanCard}
        onToggleCard={setExpandedLoanCard}
      />

      {/* Auto-generate modal */}
      {showAutoModal && (
        <AutoGenerateModal
          profile={profile}
          onGenerate={handleAutoGenerate}
          onClose={() => setShowAutoModal(false)}
        />
      )}

      {/* Loan type recommendation modal */}
      {loanRecommendModal !== null && acquisitions[loanRecommendModal] && (
        <LoanTypeRecommendationModal
          currentType={acquisitions[loanRecommendModal].loanType}
          onSelect={(loanTypeId) => updateAcquisition(loanRecommendModal, { ...acquisitions[loanRecommendModal], loanType: loanTypeId, loanRate: BELGIAN_LOAN_TYPES.find((t) => t.id === loanTypeId)?.rateRange.min || 0.035 })}
          onClose={() => setLoanRecommendModal(null)}
        />
      )}
    </div>
  )
}
