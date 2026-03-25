/**
 * PropertyDetail.jsx
 *
 * Full-page property statistics view.
 * Shows:
 *   - Key KPI strip (value, equity, total invested, ROI)
 *   - Combined value vs total-spend timeline chart (Recharts AreaChart)
 *   - Renovation / planned-investment history table
 *   - Loan summary
 *   - Full PropertyTimeline component (non-compact)
 */

import { useMemo } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import PropertyTimeline from '../PropertyTimeline'
import { getLoanPaymentSplit, getRemainingBalance } from '../../utils/projectionUtils'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('nl-BE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n ?? 0)

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatYAxis(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `€${(value / 1_000).toFixed(0)}k`
  return `€${value}`
}

/** Days between two JS Dates */
function daysBetween(a, b) {
  return (b - a) / (1000 * 60 * 60 * 24)
}

/** Years (decimal) between two JS Dates */
function yearsBetween(a, b) {
  return daysBetween(a, b) / 365.25
}

// ─── Build the year-by-year data for the combined value / spend chart ─────────

/**
 * For each calendar year from purchaseYear to today+5:
 *   - propertyValue: purchasePrice grown at appreciationRate from purchaseDate,
 *     then switch to currentValue grown at appreciationRate from valuationDate
 *   - cumulativeSpend: purchasePrice + notary estimate + all loan interest paid
 *     + all renovation costs up to that year
 *   - equity: propertyValue − remaining loan balance
 */
function buildValueSpendData(property) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Resolve dates ──────────────────────────────────────────────────────────
  const purchaseDateRaw = property.purchaseDate
    ? new Date(property.purchaseDate)
    : (() => {
        const earliest = (property.loans || [])
          .map((l) => l.startDate ? new Date(l.startDate) : null)
          .filter(Boolean)
          .sort((a, b) => a - b)[0]
        return earliest ?? new Date(today.getFullYear() - 3, 0, 1)
      })()

  const valuationDateRaw = property.valuationDate
    ? new Date(property.valuationDate)
    : today  // treat currentValue as "as of today" if no date set

  const appreciationRate = property.appreciationRate || 0.02
  const currentValue     = property.currentValue || 0
  const purchasePrice    = property.purchasePrice || 0

  const startYear = purchaseDateRaw.getFullYear()

  // Extend to the latest loan end date, last planned renovation, or at least 20y from today
  const loanEndYears = (property.loans || []).map((l) => {
    if (l.amortizationSchedule?.length > 0) {
      const dates = l.amortizationSchedule
        .map((r) => new Date(r.date || r.dueDate || r.due_date))
        .filter((d) => !isNaN(d))
      return dates.length ? Math.max(...dates.map((d) => d.getFullYear())) : 0
    }
    if (l.startDate && l.termMonths) {
      const end = new Date(l.startDate)
      end.setMonth(end.getMonth() + Number(l.termMonths))
      return end.getFullYear()
    }
    return 0
  })
  const lastRenovYear = (property.plannedInvestments || [])
    .filter((i) => i.plannedDate)
    .map((i) => new Date(i.plannedDate).getFullYear())
    .reduce((max, y) => Math.max(max, y), 0)

  const endYear = Math.max(
    today.getFullYear() + 20,
    ...loanEndYears,
    lastRenovYear,
  )

  // ── Pre-compute renovation costs grouped by year ───────────────────────────
  const renovByYear = {}
  for (const inv of property.plannedInvestments || []) {
    if (!inv.plannedDate) continue
    const y = new Date(inv.plannedDate).getFullYear()
    renovByYear[y] = (renovByYear[y] || 0) + (inv.cost || 0)
  }

  // ── Acquisition costs: use actual values when entered, else estimate ─────────
  // Flemish registration tax (verkooprecht) since 01.01.2022:
  //   - Investment / rental property (niet enige eigen woning): 12%
  //   - Sole primary home (enige eigen woning): 2% (since 01.01.2025; was 3% in 2022–2024)
  //   Note: "klein beschrijf" no longer exists as a separate rate since 2020.
  //   For a rental/investment property the rate is always 12% regardless of price.
  const estRegRate = 0.12   // standard Flemish rate for non-primary / investment properties
  const estNotary  = Math.round(purchasePrice * 0.01 + 1_500)
  // registrationTax stored as a rate fraction (e.g. 0.06); convert to EUR amount
  const regTaxRate = property.registrationTax != null ? property.registrationTax : estRegRate
  const regTax     = Math.round(purchasePrice * regTaxRate)
  const notaryFees = property.notaryFees         != null ? property.notaryFees         : estNotary
  const agencyFees = property.agencyFees         != null ? property.agencyFees         : 0
  const otherCosts = property.otherAcquisitionCosts != null ? property.otherAcquisitionCosts : 0
  const acquisitionCosts = regTax + notaryFees + agencyFees + otherCosts

  // ── Loan helpers ───────────────────────────────────────────────────────────
  const loans = property.loans || []

  /**
   * For a given calendar year-start date, sum total interest PAID so far
   * across all loans since their start dates.
   */
  function totalInterestPaidByDate(untilDate) {
    let total = 0
    for (const loan of loans) {
      const loanStart = loan.startDate ? new Date(loan.startDate) : purchaseDateRaw
      if (loanStart >= untilDate) continue

      if (loan.amortizationSchedule?.length > 0) {
        // Use actual schedule
        for (const row of loan.amortizationSchedule) {
          const rowDate = new Date(row.date || row.dueDate || row.due_date)
          if (rowDate < untilDate) {
            total += Number(row.interest ?? row.interestAmount ?? 0)
          }
        }
      } else {
        // Estimate via annuity formula month-by-month up to untilDate
        const r   = (loan.interestRate || 0) / 12
        const n   = loan.termMonths || 240
        const pmt = loan.monthlyPayment || (r > 0
          ? loan.originalAmount * r / (1 - Math.pow(1 + r, -n))
          : (loan.originalAmount / n))
        let balance = loan.originalAmount || 0
        let months  = Math.floor(yearsBetween(loanStart, untilDate) * 12)
        months = Math.max(0, Math.min(months, n))
        for (let m = 0; m < months; m++) {
          const interest = balance * r
          const capital  = pmt - interest
          total += interest
          balance = Math.max(0, balance - capital)
        }
      }
    }
    return Math.round(total)
  }

  /**
   * Remaining loan balance at a given date.
   */
  function remainingBalance(atDate) {
    let total = 0
    for (const loan of loans) {
      const loanStart = loan.startDate ? new Date(loan.startDate) : purchaseDateRaw
      if (loanStart >= atDate) { total += loan.originalAmount || 0; continue }

      if (loan.amortizationSchedule?.length > 0) {
        // Last row with due_date <= atDate
        const rows = loan.amortizationSchedule
          .filter((r) => new Date(r.date || r.dueDate || r.due_date) <= atDate)
          .sort((a, b) => new Date(b.date || b.dueDate || b.due_date) - new Date(a.date || a.dueDate || a.due_date))
        total += rows.length > 0
          ? Number(rows[0].balance ?? rows[0].remainingBalance ?? rows[0].remaining_balance ?? 0)
          : (loan.originalAmount || 0)
      } else {
        const r   = (loan.interestRate || 0) / 12
        const n   = loan.termMonths || 240
        const pmt = loan.monthlyPayment || (r > 0
          ? loan.originalAmount * r / (1 - Math.pow(1 + r, -n))
          : (loan.originalAmount / n))
        let balance = loan.originalAmount || 0
        const months = Math.max(0, Math.min(
          Math.floor(yearsBetween(loanStart, atDate) * 12), n
        ))
        for (let m = 0; m < months; m++) {
          const interest = balance * r
          const capital  = pmt - interest
          balance = Math.max(0, balance - capital)
        }
        total += balance
      }
    }
    return Math.round(total)
  }

  // ── Build year points ──────────────────────────────────────────────────────
  const points = []
  let cumulativeRenovCost = 0

  for (let y = startYear; y <= endYear; y++) {
    const yearDate = new Date(y, 0, 1)
    const isFuture = yearDate > today
    const label    = y === today.getFullYear() ? `${y} ★` : String(y)

    // Property value: from purchasePrice anchored at purchaseDate, or from
    // currentValue anchored at valuationDate, whichever anchor is more recent.
    let propertyValue
    const yearsFromValuation = yearsBetween(valuationDateRaw, yearDate)
    const yearsFromPurchase  = yearsBetween(purchaseDateRaw, yearDate)

    if (currentValue > 0 && valuationDateRaw <= yearDate) {
      // Use currentValue projected forward from valuationDate
      propertyValue = Math.round(currentValue * Math.pow(1 + appreciationRate, yearsFromValuation))
    } else if (purchasePrice > 0) {
      // Project from purchase price
      propertyValue = Math.round(purchasePrice * Math.pow(1 + appreciationRate, Math.max(0, yearsFromPurchase)))
    } else {
      propertyValue = 0
    }

    // Accumulate renovation costs up to and including this year
    cumulativeRenovCost += renovByYear[y] || 0

    // Total spend = acquisition + interest paid + ongoing renovation
    const interestPaid = totalInterestPaidByDate(isFuture ? today : yearDate)
    const cumulativeSpend = Math.round(
      purchasePrice + acquisitionCosts + interestPaid + cumulativeRenovCost
    )

    // Equity = propertyValue − remaining balance
    const balance = isFuture
      ? remainingBalance(today)  // freeze balance at today for future years to keep the chart clean
      : remainingBalance(yearDate)
    const equity = propertyValue - balance

    points.push({
      year: y,
      label,
      isFuture,
      propertyValue,
      cumulativeSpend,
      equity,
      loanBalance: balance,
      renovCostThis: renovByYear[y] || 0,
    })
  }

  return points
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

// Rotated label rendered along a ReferenceLine — receives viewBox from Recharts
function RenovationLabel({ viewBox, description, cost }) {
  if (!viewBox) return null
  const { x, y, height } = viewBox
  const text = `🔨 ${description ? description + ' · ' : ''}${fmt(cost)}`
  // Anchor near the bottom of the line, text runs upward
  const anchorY = y + height - 8
  return (
    <text
      x={x + 4}
      y={anchorY}
      transform={`rotate(-90, ${x + 4}, ${anchorY})`}
      textAnchor="start"
      dominantBaseline="middle"
      fill="#c4b5fd"
      fontSize={11}
      fontFamily="inherit"
    >
      {text}
    </text>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-neo-raised border border-neo-border rounded-xl p-3 shadow-xl text-xs min-w-[200px]">
      <p className="font-semibold text-neo-text mb-2 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }} className="font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-neo-text font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'text-neo-text', highlight = false }) {
  return (
    <div className={`rounded-2xl p-3 sm:p-4 ${highlight
      ? 'bg-gradient-to-br from-brand-600/30 to-brand-700/20 border border-brand-500/30'
      : 'bg-neo-sunken/55'}`}>
      <p className="text-xs text-neo-muted mb-1">{label}</p>
      <p className={`text-base sm:text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-neo-subtle mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-neo-text text-base border-b border-neo-border pb-2">{title}</h3>
      {children}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  owner_occupied: { label: 'Owner-occupied', color: 'bg-sky-400/15 text-sky-300 border-sky-400/30' },
  rented:         { label: 'Rented out',     color: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
  vacant:         { label: 'Vacant',         color: 'bg-white/5 text-neo-muted border-white/10' },
  for_sale:       { label: 'For sale',       color: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  renovation:     { label: 'Renovation',     color: 'bg-orange-400/15 text-orange-300 border-orange-400/30' },
  planned:        { label: 'Planned',        color: 'bg-violet-400/15 text-violet-300 border-violet-400/30' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.owner_occupied
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertyDetail({ property, onEdit, onBack }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Derived values ──────────────────────────────────────────────────────────
  const loans        = property.loans || []
  const renovations  = (property.plannedInvestments || [])
    .slice()
    .sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate))

  const totalLoanBalance = loans.reduce((s, l) => {
    return s + getRemainingBalance(l, today.toISOString())
  }, 0)

  const totalRenovCost   = renovations.reduce((s, r) => s + (r.cost || 0), 0)
  const totalRenovValue  = renovations.reduce((s, r) => s + (r.valueIncrease || 0), 0)
  const pastRenovCost    = renovations
    .filter((r) => r.plannedDate && new Date(r.plannedDate) <= today)
    .reduce((s, r) => s + (r.cost || 0), 0)

  const equity = (property.currentValue || 0) - totalLoanBalance

  const pp = property.purchasePrice || 0

  // ── Acquisition costs — actual entries or Belgian estimate ─────────────────
  // Flemish registration tax (verkooprecht) since 01.01.2022:
  //   - Investment / rental property: always 12% (geen enige eigen woning)
  //   - "Klein beschrijf" as a rate-based concept no longer exists; there is
  //     a fixed €1,867 reduction for bescheiden woningen (≤€220k) on a sole
  //     primary home only — not applicable to investment/rental properties.
  const estRegRate   = 0.12  // standard Flemish rate for investment/rental properties
  const estNotaryAmt = Math.round(pp * 0.01 + 1_500)

  // registrationTax is stored as a rate fraction; convert to EUR for display
  const hasActualRegRate = property.registrationTax != null
  const regTaxRate       = hasActualRegRate ? property.registrationTax : estRegRate
  const regTaxAmt        = Math.round(pp * regTaxRate)

  const hasActualNotary = property.notaryFees != null
  const notaryAmt       = hasActualNotary ? property.notaryFees : estNotaryAmt

  const hasActualAgency = property.agencyFees != null
  const agencyAmt       = hasActualAgency ? property.agencyFees : 0

  const hasActualOther = property.otherAcquisitionCosts != null
  const otherAmt       = hasActualOther ? property.otherAcquisitionCosts : 0

  const acqCosts = regTaxAmt + notaryAmt + agencyAmt + otherAmt

  // Total interest paid to date (approximate via getLoanPaymentSplit monthly payments)
  const totalInterestPaid = useMemo(() => {
    let total = 0
    for (const loan of loans) {
      const loanStart = loan.startDate ? new Date(loan.startDate) : (
        property.purchaseDate ? new Date(property.purchaseDate) : today
      )
      if (loan.amortizationSchedule?.length > 0) {
        for (const row of loan.amortizationSchedule) {
          const rowDate = new Date(row.date || row.dueDate || row.due_date)
          if (rowDate <= today) total += Number(row.interest ?? row.interestAmount ?? 0)
        }
      } else {
        const r   = (loan.interestRate || 0) / 12
        const n   = loan.termMonths || 240
        const pmt = loan.monthlyPayment || (r > 0
          ? loan.originalAmount * r / (1 - Math.pow(1 + r, -n))
          : (loan.originalAmount / n))
        let balance = loan.originalAmount || 0
        const months = Math.max(0, Math.min(
          Math.floor(yearsBetween(loanStart, today) * 12), n
        ))
        for (let m = 0; m < months; m++) {
          const interest = balance * r
          const capital  = pmt - interest
          total += interest
          balance = Math.max(0, balance - capital)
        }
      }
    }
    return Math.round(total)
  }, [loans, property.purchaseDate])

  const totalInvested = pp + acqCosts + pastRenovCost + totalInterestPaid
  const unrealisedGain = (property.currentValue || 0) - pp - acqCosts - pastRenovCost
  const roiPct = totalInvested > 0
    ? ((property.currentValue || 0) - totalInvested) / totalInvested * 100
    : 0

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => buildValueSpendData(property), [property])

  // Split into historical and future for styling purposes
  const allYears = chartData

  // ── Valuation date display ─────────────────────────────────────────────────
  const valuationLabel = property.valuationDate
    ? `as of ${fmtDate(property.valuationDate)}`
    : 'valuation date not set'

  // ── My ownership share ─────────────────────────────────────────────────────
  const owners  = property.owners || [{ name: 'Me', share: 1 }]
  const myOwner = owners.find((o) => /^me$/i.test(o.name?.trim())) ?? owners[0]
  const myShare = Number(myOwner?.share ?? 1)

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        {/* Back button */}
        <button
          onClick={onBack}
          className="text-neo-muted hover:text-neo-text transition-colors p-2 rounded-xl hover:bg-neo-sunken shrink-0 mt-0.5 active:scale-95"
          title="Back to properties"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Title + status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-neo-text leading-tight">{property.name}</h1>
            <StatusBadge status={property.status} />
          </div>
          {property.address && (
            <p className="text-neo-muted text-sm mt-0.5 truncate">{property.address}</p>
          )}
        </div>

        {/* Edit button */}
        <button onClick={onEdit} className="btn-primary shrink-0 active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="hidden sm:inline">Edit Property</span>
          <span className="sm:hidden">Edit</span>
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard
          label="Market Value"
          value={fmt(property.currentValue)}
          sub={valuationLabel}
          color="text-neo-text"
          highlight
        />
        <KpiCard
          label="Equity (my share)"
          value={fmt(equity * myShare)}
          sub={myShare < 1 ? `${Math.round(myShare * 100)}% of ${fmt(equity)}` : undefined}
          color={equity >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <KpiCard
          label="Total invested to date"
          value={fmt(totalInvested)}
          sub="purchase + costs + interest + reno"
          color="text-amber-300"
        />
        <KpiCard
          label="Unrealised gain"
          value={(unrealisedGain >= 0 ? '+' : '') + fmt(unrealisedGain)}
          sub={`${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}% ROI`}
          color={unrealisedGain >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* ── Value vs cumulative spend chart ── */}
      <div className="card">
        <div className="mb-5">
          <h2 className="font-semibold text-neo-text">Property Value vs. Total Spend</h2>
          <p className="text-xs text-neo-muted mt-0.5">
            Market value projected from your {property.valuationDate ? `${fmtDate(property.valuationDate)} valuation` : 'current estimate'} at {((property.appreciationRate || 0.02) * 100).toFixed(1)}%/yr.
            Spend includes purchase price, estimated acquisition costs, all loan interest paid, and renovation costs.
            {!property.valuationDate && (
              <span className="text-amber-400"> Set a valuation date on the property to anchor the projection accurately.</span>
            )}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-neo-muted mb-4">
          {[
            { color: '#10b981', label: 'Market Value' },
            { color: '#f59e0b', label: 'Total Spend' },
            { color: '#38bdf8', label: 'Equity' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
          {renovations.some((r) => r.plannedDate) && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-sm shrink-0" style={{ borderTop: '2px solid #a78bfa' }} />
              Renovation
            </span>
          )}
        </div>

        <ResponsiveContainer width="100%" height={isMobile ? 220 : 320}>
          <AreaChart data={allYears} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.40} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              interval={allYears.length > 15 ? 4 : allYears.length > 8 ? 1 : 0}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 52 : 68}
            />
            <RechartsTooltip content={<ChartTooltip />} />
            <ReferenceLine
              x={`${today.getFullYear()} ★`}
              stroke="#64748b"
              strokeDasharray="4 3"
              label={{ value: 'Today', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }}
            />
            {/* Renovation markers — vertical line with label rotated along the line */}
            {renovations
              .filter((r) => r.plannedDate)
              .map((r) => {
                const y = new Date(r.plannedDate).getFullYear()
                const point = allYears.find((p) => p.year === y)
                if (!point) return null
                return (
                  <ReferenceLine
                    key={r.id}
                    x={point.label}
                    stroke="#a78bfa"
                    strokeWidth={2}
                    label={<RenovationLabel description={r.description} cost={r.cost} />}
                  />
                )
              })}
            <Area
              type="monotone"
              dataKey="propertyValue"
              name="Market Value"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#gVal)"
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeSpend"
              name="Total Spend"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#gSpend)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              name="Equity"
              stroke="#38bdf8"
              strokeWidth={2}
              fill="url(#gEquity)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Spend breakdown table ── */}
      <Section title="Cost Breakdown">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neo-border">
                <th className="text-left py-2 text-neo-muted font-medium text-xs pr-3">Category</th>
                <th className="text-right py-2 text-neo-muted font-medium text-xs px-2">Amount</th>
                <th className="text-left py-2 text-neo-muted font-medium text-xs pl-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neo-border/50">
              <tr className="hover:bg-neo-sunken/30">
                <td className="py-2 pr-3 text-neo-muted">Purchase price</td>
                <td className="py-2 px-2 text-right font-medium text-neo-text">{fmt(pp)}</td>
                <td className="py-2 pl-2 text-neo-subtle text-xs">{fmtDate(property.purchaseDate)}</td>
              </tr>
              <tr className="hover:bg-neo-sunken/30">
                <td className="py-2 pr-3 text-neo-muted">Registration tax</td>
                <td className="py-2 px-2 text-right font-medium text-amber-300">{fmt(regTaxAmt)}</td>
                <td className="py-2 pl-2 text-neo-subtle text-xs">
                  {(regTaxRate * 100).toFixed(2)}%
                  {hasActualRegRate ? ' (actual)' : ' — estimated (standard 12%, Flemish investment property rate)'}
                </td>
              </tr>
              <tr className="hover:bg-neo-sunken/30">
                <td className="py-2 pr-3 text-neo-muted">Notary fees</td>
                <td className="py-2 px-2 text-right font-medium text-amber-300">{fmt(notaryAmt)}</td>
                <td className="py-2 pl-2 text-neo-subtle text-xs">
                  {hasActualNotary ? 'actual' : 'estimated (1% + €1,500)'}
                </td>
              </tr>
              {agencyAmt > 0 && (
                <tr className="hover:bg-neo-sunken/30">
                  <td className="py-2 pr-3 text-neo-muted">Agency / broker fees</td>
                  <td className="py-2 px-2 text-right font-medium text-amber-300">{fmt(agencyAmt)}</td>
                  <td className="py-2 pl-2 text-neo-subtle text-xs">actual</td>
                </tr>
              )}
              {otherAmt > 0 && (
                <tr className="hover:bg-neo-sunken/30">
                  <td className="py-2 pr-3 text-neo-muted">Other acquisition costs</td>
                  <td className="py-2 px-2 text-right font-medium text-amber-300">{fmt(otherAmt)}</td>
                  <td className="py-2 pl-2 text-neo-subtle text-xs">actual</td>
                </tr>
              )}
              {totalInterestPaid > 0 && (
                <tr className="hover:bg-neo-sunken/30">
                  <td className="py-2 pr-3 text-neo-muted">Loan interest paid to date</td>
                  <td className="py-2 px-2 text-right font-medium text-red-400">{fmt(totalInterestPaid)}</td>
                  <td className="py-2 pl-2 text-neo-subtle text-xs">
                    {loans.length} loan{loans.length !== 1 ? 's' : ''}{loans.some((l) => l.amortizationSchedule?.length) ? ' (from schedule)' : ' (estimated)'}
                  </td>
                </tr>
              )}
              {pastRenovCost > 0 && (
                <tr className="hover:bg-neo-sunken/30">
                  <td className="py-2 pr-3 text-neo-muted">Renovations completed</td>
                  <td className="py-2 px-2 text-right font-medium text-violet-400">{fmt(pastRenovCost)}</td>
                  <td className="py-2 pl-2 text-neo-subtle text-xs">
                    {renovations.filter((r) => r.plannedDate && new Date(r.plannedDate) <= today).length} renovation{renovations.filter((r) => r.plannedDate && new Date(r.plannedDate) <= today).length !== 1 ? 's' : ''}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-neo-border bg-neo-sunken/20">
                <td className="py-2 pr-3 font-semibold text-neo-text">Total invested to date</td>
                <td className="py-2 px-2 text-right font-bold text-amber-300">{fmt(totalInvested)}</td>
                <td className="py-2 pl-2 text-neo-subtle text-xs" />
              </tr>
              <tr className="hover:bg-neo-sunken/30">
                <td className="py-2 pr-3 text-neo-muted">Current market value</td>
                <td className="py-2 px-2 text-right font-medium text-emerald-400">{fmt(property.currentValue)}</td>
                <td className="py-2 pl-2 text-neo-subtle text-xs">{valuationLabel}</td>
              </tr>
              <tr className="bg-neo-sunken/20">
                <td className="py-2 pr-3 font-semibold text-neo-text">Unrealised gain</td>
                <td className={`py-2 px-2 text-right font-bold ${unrealisedGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {unrealisedGain >= 0 ? '+' : ''}{fmt(unrealisedGain)}
                </td>
                <td className="py-2 pl-2 text-neo-subtle text-xs">
                  {roiPct >= 0 ? '+' : ''}{roiPct.toFixed(1)}% on total invested
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Renovation history ── */}
      {renovations.length > 0 && (
        <Section title="Renovation & Investment History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-neo-border">
                  <th className="text-left py-2 text-neo-muted font-medium text-xs pr-3">Date</th>
                  <th className="text-left py-2 text-neo-muted font-medium text-xs pr-3">Description</th>
                  <th className="text-right py-2 text-neo-muted font-medium text-xs px-2">Cost</th>
                  <th className="text-right py-2 text-neo-muted font-medium text-xs px-2">Value added</th>
                  <th className="text-right py-2 text-neo-muted font-medium text-xs pl-2">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neo-border/50">
                {renovations.map((r) => {
                  const isPast = r.plannedDate && new Date(r.plannedDate) <= today
                  const net    = (r.valueIncrease || 0) - (r.cost || 0)
                  return (
                    <tr key={r.id} className="hover:bg-neo-sunken/30">
                      <td className="py-2 pr-3">
                        <span className={`text-xs font-medium ${isPast ? 'text-neo-muted' : 'text-amber-400'}`}>
                          {fmtDate(r.plannedDate)}
                        </span>
                        {!isPast && (
                          <span className="ml-1 text-xs text-amber-500">planned</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-neo-text/95">{r.description || '—'}</td>
                      <td className="py-2 px-2 text-right text-red-400 font-medium">
                        {r.cost ? `-${fmt(r.cost)}` : '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-400 font-medium">
                        {r.valueIncrease ? `+${fmt(r.valueIncrease)}` : '—'}
                      </td>
                      <td className={`py-2 pl-2 text-right font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {net >= 0 ? '+' : ''}{fmt(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-neo-border">
                <tr className="bg-neo-sunken/20">
                  <td colSpan={2} className="py-2 pr-3 font-semibold text-neo-text text-sm">Total</td>
                  <td className="py-2 px-2 text-right font-bold text-red-400">{`-${fmt(totalRenovCost)}`}</td>
                  <td className="py-2 px-2 text-right font-bold text-emerald-400">{`+${fmt(totalRenovValue)}`}</td>
                  <td className={`py-2 pl-2 text-right font-bold ${totalRenovValue - totalRenovCost >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalRenovValue - totalRenovCost >= 0 ? '+' : ''}{fmt(totalRenovValue - totalRenovCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      )}

      {/* ── Loan summary ── */}
      {loans.length > 0 && (
        <Section title="Loans">
          <div className="space-y-3">
            {loans.map((loan, i) => {
              const { monthlyTotal: monthly, monthlyInterest: interest, monthlyCapital: capital } = getLoanPaymentSplit(loan, today)
              const remaining = getRemainingBalance(loan, today.toISOString())
              const pctRepaid = loan.originalAmount > 0
                ? (1 - remaining / loan.originalAmount) * 100
                : 0
              return (
                <div key={loan.id ?? i} className="rounded-xl border border-neo-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-neo-text">{loan.lender || `Loan ${i + 1}`}</p>
                      <p className="text-xs text-neo-muted mt-0.5">
                        {fmt(loan.originalAmount)} at {((loan.interestRate || 0) * 100).toFixed(2)}% — {loan.termMonths || '?'} months
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neo-text">{fmt(remaining)} remaining</p>
                      <p className="text-xs text-neo-muted">{pctRepaid.toFixed(0)}% repaid</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-neo-sunken rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, pctRepaid)}%` }}
                    />
                  </div>
                  {/* Monthly breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-neo-sunken/70 p-2">
                      <p className="text-neo-muted mb-0.5">Monthly</p>
                      <p className="font-semibold text-neo-text">{fmt(monthly)}</p>
                    </div>
                    <div className="rounded-lg bg-neo-sunken/70 p-2">
                      <p className="text-neo-muted mb-0.5">Interest</p>
                      <p className="font-semibold text-red-400">{fmt(interest)}</p>
                    </div>
                    <div className="rounded-lg bg-neo-sunken/70 p-2">
                      <p className="text-neo-muted mb-0.5">Capital</p>
                      <p className="font-semibold text-teal-400">{fmt(capital)}</p>
                    </div>
                  </div>
                  {loan.amortizationSchedule?.length > 0 && (
                    <p className="text-xs text-brand-400">
                      Schedule uploaded ({loan.amortizationSchedule.length} rows)
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Full property timeline ── */}
      {(loans.length > 0 || property.rentalStartDate || property.purchaseDate) && (
        <div className="card">
          <h3 className="font-semibold text-neo-text text-base border-b border-neo-border pb-2 mb-4">
            Property Timeline
          </h3>
          <PropertyTimeline property={property} compact={false} />
        </div>
      )}

    </div>
  )
}


