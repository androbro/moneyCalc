/**
 * PropertyTimeline.jsx
 *
 * An interactive horizontal timeline for a single property showing:
 *   • Loan repayment phase  (purchase → loan end)
 *   • Rental phase          (rental start → beyond loan end)
 *   • Pure-profit phase     (loan end → end of view, rent with no loan)
 *   • Today marker          (where we are now)
 *   • Hover tooltips        (year-by-year financials)
 *
 * Props:
 *   property  – full property object (with loans, rentalStartDate, etc.)
 *   compact   – boolean: compact mode for Dashboard cards (default false)
 */

import { useMemo, useState, useRef } from 'react'
import { getRemainingBalance } from '../utils/projectionUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtSigned = (n) => (n >= 0 ? `+${fmt(n)}` : fmt(n))

function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Build a year-by-year snapshot for the property timeline.
 * Returns array of { year, date, loanBalance, annualRent, annualCosts,
 *                    annualInterest, annualCapital, annualCF, cumulativeCF }
 */
function buildTimelineData(property, loans, startDate, totalYears) {
  const points = []
  let cumulativeCF = 0
  const today = new Date()

  for (let y = 0; y <= totalYears; y++) {
    const date = addMonths(startDate, y * 12)
    const dateISO = date.toISOString()

    // Loan balance
    const loanBalance = loans.reduce((s, l) => s + getRemainingBalance(l, dateISO), 0)

    // Annual loan payments split into interest + capital
    let annualInterest = 0
    let annualCapital  = 0
    for (const l of loans) {
      if (!l.startDate || !l.termMonths) continue
      const loanStart = new Date(l.startDate)
      const loanEnd   = addMonths(loanStart, l.termMonths)
      if (date >= loanEnd) continue // loan paid off

      const monthlyPayment = l.monthlyPayment || 0
      const balance = getRemainingBalance(l, dateISO)
      const monthlyRate = (l.interestRate || 0) / 12
      const monthlyInterest = balance * monthlyRate
      const monthlyCapital  = Math.max(0, monthlyPayment - monthlyInterest)
      annualInterest += monthlyInterest * 12
      annualCapital  += monthlyCapital  * 12
    }

    // Rental income (check if rental is active at this date)
    let annualRent = 0
    const rentalStart = property.rentalStartDate ? new Date(property.rentalStartDate) : null
    const rentalEnd   = property.rentalEndDate   ? new Date(property.rentalEndDate)   : null
    const rentalActive = (
      (property.status === 'rented' || rentalStart) &&
      (!rentalStart || date >= rentalStart) &&
      (!rentalEnd   || date <= rentalEnd)
    )
    if (rentalActive) {
      const yearsRenting = rentalStart
        ? Math.max(0, (date - rentalStart) / (365.25 * 24 * 60 * 60 * 1000))
        : y
      const baseRent = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
      annualRent = baseRent * Math.pow(1 + (property.indexationRate || 0.02), yearsRenting)
    }

    // Annual operating costs (inflation-indexed)
    const yOffset = Math.max(0, (date - today) / (365.25 * 24 * 60 * 60 * 1000))
    const inflRate = property.inflationRate || 0.02
    const annualCosts =
      (property.annualMaintenanceCost || 0) * Math.pow(1 + inflRate, yOffset) +
      (property.annualInsuranceCost   || 0) * Math.pow(1 + inflRate, yOffset) +
      (property.monthlyExpenses       || 0) * 12 * Math.pow(1 + inflRate, yOffset) +
      (property.annualPropertyTax     || 0)

    // CF = rent - opex - interest (capital is equity)
    const annualCF = annualRent - annualCosts - annualInterest
    if (y > 0) cumulativeCF += annualCF

    points.push({
      y, date, loanBalance: Math.round(loanBalance),
      annualRent: Math.round(annualRent),
      annualCosts: Math.round(annualCosts),
      annualInterest: Math.round(annualInterest),
      annualCapital: Math.round(annualCapital),
      annualCF: Math.round(annualCF),
      cumulativeCF: Math.round(cumulativeCF),
    })
  }
  return points
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ point, anchorPct, visible }) {
  if (!point || !visible) return null
  const year = point.date.getFullYear()

  return (
    <div
      className="absolute z-50 bottom-full mb-3 pointer-events-none"
      style={{
        left: `clamp(8px, calc(${anchorPct}% - 120px), calc(100% - 248px))`,
        width: 240,
      }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-2xl text-xs">
        <p className="font-bold text-white mb-2">{year}</p>
        <div className="space-y-1">
          {point.annualRent > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Rental income</span>
              <span className="text-emerald-400 font-semibold">{fmt(point.annualRent)}/yr</span>
            </div>
          )}
          {point.annualCosts > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Operating costs</span>
              <span className="text-red-400">−{fmt(point.annualCosts)}</span>
            </div>
          )}
          {point.annualInterest > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Loan interest</span>
              <span className="text-red-400">−{fmt(point.annualInterest)}</span>
            </div>
          )}
          {point.annualCapital > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Capital repaid</span>
              <span className="text-teal-400">+{fmt(point.annualCapital)} equity</span>
            </div>
          )}
          {point.loanBalance > 0 && (
            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
              <span className="text-slate-400">Remaining loan</span>
              <span className="text-amber-300">{fmt(point.loanBalance)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
            <span className="text-slate-300 font-medium">Annual CF</span>
            <span className={`font-bold ${point.annualCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtSigned(point.annualCF)}
            </span>
          </div>
          {point.y > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Cumulative CF</span>
              <span className={`font-semibold ${point.cumulativeCF >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {fmtSigned(point.cumulativeCF)}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Arrow */}
      <div className="w-0 h-0 mx-auto"
        style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #475569' }} />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PropertyTimeline({ property, compact = false }) {
  const [hoveredY, setHoveredY] = useState(null)
  const [tooltipAnchor, setTooltipAnchor] = useState(0)
  const containerRef = useRef(null)

  const { points, phases, purchaseDate, loanEndDate, rentalStartDate, rentalEndDate, viewEnd, totalYears } = useMemo(() => {
    const today = new Date()
    const loans = property.loans || []

    // Purchase / origin of timeline
    const purchaseDate = property.purchaseDate
      ? new Date(property.purchaseDate)
      : (() => {
          // Fallback: derive from earliest loan start, or today − 1yr
          const earliest = loans.reduce((min, l) => {
            const d = l.startDate ? new Date(l.startDate) : today
            return d < min ? d : min
          }, today)
          return earliest < today ? earliest : new Date(today.getFullYear() - 1, today.getMonth(), 1)
        })()

    // Loan end: latest of all loan maturity dates
    const loanEndDate = loans.reduce((max, l) => {
      if (!l.startDate || !l.termMonths) return max
      const end = addMonths(new Date(l.startDate), Number(l.termMonths))
      return end > max ? end : max
    }, purchaseDate)

    // If no loans, loanEndDate = purchaseDate (no loan phase)
    const hasLoans = loanEndDate > purchaseDate

    // Rental window
    const rentalStartDate = property.rentalStartDate ? new Date(property.rentalStartDate) : null
    const rentalEndDate   = property.rentalEndDate   ? new Date(property.rentalEndDate)   : null

    // Show +5 years of pure-profit beyond loan end (or beyond today if no loans)
    const profitExtend = compact ? 3 : 5
    const viewEnd = new Date(Math.max(
      loanEndDate.getTime(),
      (rentalEndDate || today).getTime()
    ))
    viewEnd.setFullYear(viewEnd.getFullYear() + profitExtend)

    // Total years from purchase to view end
    const totalYears = Math.ceil((viewEnd - purchaseDate) / (365.25 * 24 * 60 * 60 * 1000))

    const points = buildTimelineData(property, loans, purchaseDate, totalYears)

    // Compute phases as [startPct, endPct, type] for the track
    // Type: 'loan-only' | 'loan+rent' | 'rent-only' | 'no-income' | 'profit'
    function dateToPct(d) {
      const clamped = Math.max(purchaseDate, Math.min(viewEnd, d))
      return ((clamped - purchaseDate) / (viewEnd - purchaseDate)) * 100
    }

    const phases = []

    if (!hasLoans) {
      // No loan — just rental/profit
      if (rentalStartDate && rentalStartDate > purchaseDate) {
        phases.push({ type: 'no-income', from: 0, to: dateToPct(rentalStartDate) })
      }
      const rStart = rentalStartDate ? dateToPct(rentalStartDate) : 0
      const rEnd   = rentalEndDate   ? dateToPct(rentalEndDate)   : 100
      phases.push({ type: 'profit', from: rStart, to: rEnd })
      if (rentalEndDate) phases.push({ type: 'no-income', from: rEnd, to: 100 })
    } else {
      // Phase 1: purchase → min(rental start, loan end) — loan only, no rent
      const loanEndPct = dateToPct(loanEndDate)
      const rentalPct  = rentalStartDate ? dateToPct(rentalStartDate) : null

      if (rentalPct === null || rentalPct >= loanEndPct) {
        // No rental starts before loan ends
        phases.push({ type: 'loan-only', from: 0, to: loanEndPct })
        if (rentalPct !== null) {
          if (rentalPct > loanEndPct) {
            phases.push({ type: 'no-income', from: loanEndPct, to: rentalPct })
          }
          const rEnd = rentalEndDate ? dateToPct(rentalEndDate) : 100
          phases.push({ type: 'profit', from: Math.max(loanEndPct, rentalPct), to: rEnd })
          if (rentalEndDate) phases.push({ type: 'no-income', from: rEnd, to: 100 })
        } else {
          phases.push({ type: 'profit', from: loanEndPct, to: 100 })
        }
      } else {
        // Rental starts before loan ends
        if (rentalPct > 0) {
          phases.push({ type: 'loan-only', from: 0, to: rentalPct })
        }
        phases.push({ type: 'loan+rent', from: rentalPct, to: loanEndPct })
        const rEnd = rentalEndDate ? dateToPct(rentalEndDate) : 100
        phases.push({ type: 'profit', from: loanEndPct, to: Math.min(rEnd, 100) })
        if (rentalEndDate && rEnd < 100) {
          phases.push({ type: 'no-income', from: rEnd, to: 100 })
        }
      }
    }

    return { points, phases, purchaseDate, loanEndDate, rentalStartDate, rentalEndDate, viewEnd, totalYears }
  }, [property, compact])

  const today = new Date()
  const todayPct = Math.max(0, Math.min(100,
    ((today - purchaseDate) / (viewEnd - purchaseDate)) * 100
  ))
  const rentalStartPct = rentalStartDate
    ? Math.max(0, Math.min(100, ((rentalStartDate - purchaseDate) / (viewEnd - purchaseDate)) * 100))
    : null
  const loanEndPct = loanEndDate > purchaseDate
    ? Math.max(0, Math.min(100, ((loanEndDate - purchaseDate) / (viewEnd - purchaseDate)) * 100))
    : null

  const hoveredPoint = hoveredY !== null ? points[hoveredY] : null

  const PHASE_STYLE = {
    'loan-only':  'bg-red-900/50 border-red-700/50',
    'loan+rent':  'bg-amber-900/40 border-amber-700/50',
    'rent-only':  'bg-emerald-900/40 border-emerald-700/50',
    'no-income':  'bg-slate-800/60 border-slate-700/40',
    'profit':     'bg-emerald-900/50 border-emerald-700/60',
  }
  const PHASE_LABEL = {
    'loan-only':  'Loan repayment',
    'loan+rent':  'Loan + rental',
    'rent-only':  'Rental only',
    'no-income':  'No income',
    'profit':     'Pure profit',
  }

  // Year tick marks
  const tickYears = useMemo(() => {
    const ticks = []
    const step  = totalYears <= 15 ? 2 : totalYears <= 25 ? 5 : 10
    for (let y = 0; y <= totalYears; y += step) {
      const d = addMonths(purchaseDate, y * 12)
      ticks.push({ y, year: d.getFullYear(), pct: (y / totalYears) * 100 })
    }
    return ticks
  }, [totalYears, purchaseDate])

  // CF bar data (annual, clamped for display)
  const maxAbsCF = useMemo(() => {
    return Math.max(1, ...points.slice(1).map((p) => Math.abs(p.annualCF)))
  }, [points])

  const trackH = compact ? 'h-6' : 'h-8'
  const barH   = compact ? 32 : 48

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Property Timeline</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              From purchase to loan payoff and beyond — hover any year for details
            </p>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 justify-end">
            {[
              { key: 'loan-only', label: 'Loan only' },
              { key: 'loan+rent', label: 'Loan + rent' },
              { key: 'profit',    label: 'Pure profit' },
            ].map(({ key, label }) => (
              <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PHASE_STYLE[key]} ${
                key === 'loan-only' ? 'text-red-300' : key === 'loan+rent' ? 'text-amber-300' : 'text-emerald-300'
              }`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Phase track ── */}
      <div ref={containerRef} className="relative select-none" style={{ paddingBottom: 28 }}>

        {/* Tooltip */}
        {hoveredPoint && (
          <Tooltip point={hoveredPoint} anchorPct={tooltipAnchor} visible />
        )}

        {/* Phase segments */}
        <div className={`relative w-full ${trackH} rounded-full overflow-hidden flex`}>
          {phases.map((ph, i) => (
            <div
              key={i}
              className={`${PHASE_STYLE[ph.type]} border-y transition-opacity`}
              style={{ width: `${ph.to - ph.from}%`, borderLeft: i === 0 ? undefined : 'none' }}
            />
          ))}
        </div>

        {/* Hover hit zones (one per year) */}
        <div className="absolute inset-0 flex" style={{ bottom: 28 }}>
          {points.map((pt) => {
            const pct = (pt.y / totalYears) * 100
            const nextPct = ((pt.y + 1) / totalYears) * 100
            const width = nextPct - pct
            if (width <= 0) return null
            return (
              <div
                key={pt.y}
                className="absolute top-0 cursor-crosshair"
                style={{ left: `${pct}%`, width: `${width}%`, height: compact ? 24 : 32 }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  const x = e.clientX - (rect?.left ?? 0)
                  setTooltipAnchor((x / (rect?.width ?? 1)) * 100)
                  setHoveredY(pt.y)
                }}
                onMouseLeave={() => setHoveredY(null)}
              />
            )
          })}
        </div>

        {/* Today marker */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div
            className="absolute top-0 w-0.5 bg-white/80 pointer-events-none"
            style={{ left: `${todayPct}%`, height: compact ? 24 : 32 }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
            {!compact && (
              <div className="absolute top-full mt-0.5 -translate-x-1/2 text-[9px] text-white font-bold whitespace-nowrap">
                Today
              </div>
            )}
          </div>
        )}

        {/* Rental start marker */}
        {rentalStartPct !== null && rentalStartPct > 0 && rentalStartPct < 100 && (
          <div
            className="absolute top-0 w-0.5 bg-emerald-400/80 pointer-events-none"
            style={{ left: `${rentalStartPct}%`, height: compact ? 24 : 32 }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400" />
            {!compact && (
              <div className="absolute top-full mt-0.5 -translate-x-1/2 text-[9px] text-emerald-400 font-bold whitespace-nowrap">
                Rental starts
              </div>
            )}
          </div>
        )}

        {/* Loan end marker */}
        {loanEndPct !== null && loanEndPct > 0 && loanEndPct < 100 && (
          <div
            className="absolute top-0 w-0.5 bg-amber-400/80 pointer-events-none"
            style={{ left: `${loanEndPct}%`, height: compact ? 24 : 32 }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400" />
            {!compact && (
              <div className="absolute top-full mt-0.5 -translate-x-1/2 text-[9px] text-amber-400 font-bold whitespace-nowrap">
                Loan ends
              </div>
            )}
          </div>
        )}

        {/* Year tick marks */}
        <div className="absolute w-full" style={{ top: compact ? 26 : 34 }}>
          {tickYears.map(({ year, pct }) => (
            <div
              key={year}
              className="absolute -translate-x-1/2 text-[9px] text-slate-500"
              style={{ left: `${pct}%` }}
            >
              {year}
            </div>
          ))}
        </div>
      </div>

      {/* ── Annual CF bars ── */}
      {!compact && points.length > 1 && (
        <div className="relative" style={{ height: barH * 2 + 12 }}>
          {/* Zero line */}
          <div
            className="absolute w-full border-t border-slate-600/60"
            style={{ top: barH }}
          />
          <div className="absolute flex items-end w-full gap-px" style={{ top: 0, height: barH * 2 }}>
            {points.slice(1).map((pt) => {
              const ratio   = Math.abs(pt.annualCF) / maxAbsCF
              const barPx   = Math.max(2, ratio * barH)
              const isPos   = pt.annualCF >= 0
              const isHover = hoveredY === pt.y
              return (
                <div
                  key={pt.y}
                  className="flex-1 flex flex-col cursor-crosshair relative"
                  style={{ height: barH * 2 }}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect()
                    const x    = e.currentTarget.getBoundingClientRect().left - (rect?.left ?? 0) + e.currentTarget.offsetWidth / 2
                    setTooltipAnchor((x / (rect?.width ?? 1)) * 100)
                    setHoveredY(pt.y)
                  }}
                  onMouseLeave={() => setHoveredY(null)}
                >
                  {/* Positive bars grow upward from center */}
                  <div className="flex-1 flex items-end justify-center pb-0">
                    {isPos && (
                      <div
                        className={`w-full rounded-t transition-all ${isHover ? 'bg-emerald-400' : 'bg-emerald-600/70'}`}
                        style={{ height: barPx }}
                      />
                    )}
                  </div>
                  {/* Negative bars grow downward from center */}
                  <div className="flex-1 flex items-start justify-center pt-0">
                    {!isPos && (
                      <div
                        className={`w-full rounded-b transition-all ${isHover ? 'bg-red-400' : 'bg-red-700/70'}`}
                        style={{ height: barPx }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* CF axis label */}
          <div className="absolute right-0 top-0 text-[9px] text-emerald-500 font-medium">+CF</div>
          <div className="absolute right-0 bottom-0 text-[9px] text-red-500 font-medium">−CF</div>
        </div>
      )}

      {/* ── Key milestones summary strip ── */}
      {!compact && (
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/80" />
            <span className="text-slate-400">Today</span>
          </div>
          {loanEndDate > purchaseDate && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-400">Loan ends <span className="text-amber-300">{loanEndDate.getFullYear()}</span></span>
            </div>
          )}
          {rentalStartDate && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Rental starts <span className="text-emerald-300">{rentalStartDate.toLocaleDateString('nl-BE', { month: 'short', year: 'numeric' })}</span></span>
            </div>
          )}
          {(() => {
            const profitPoint = points.find((p) => p.annualCF > 0 && p.loanBalance === 0)
            if (!profitPoint) return null
            return (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-400">
                  Pure profit from <span className="text-emerald-300">{profitPoint.date.getFullYear()}</span>
                  <span className="text-slate-500 ml-1">({fmt(profitPoint.annualRent)}/yr rent)</span>
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
