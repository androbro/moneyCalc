import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  computeSummary,
  formatEUR,
  getRemainingBalance,
  isRentalActiveOn,
} from '../utils/projectionUtils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

// ─── Utilities ────────────────────────────────────────────────────────────────

function kFmt(v) {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`
  return formatEUR(v)
}

function computeHealthScore(ltv, monthlyCF, propertyCount) {
  let score = 100
  if (ltv !== null) {
    if      (ltv > 80) score -= 40
    else if (ltv > 65) score -= 25
    else if (ltv > 50) score -= 12
    else if (ltv > 35) score -= 5
  }
  if (monthlyCF < 0)      score -= 18
  else if (monthlyCF > 2000) score  = Math.min(100, score + 5)
  if (propertyCount < 2)  score -= 5
  return Math.max(10, Math.min(100, Math.round(score)))
}

function healthLabel(score) {
  if (score >= 80) return 'Very Healthy'
  if (score >= 60) return 'Healthy'
  if (score >= 40) return 'Fair'
  return 'At Risk'
}

// ─── Chart data generators ────────────────────────────────────────────────────

function _projectPoints(properties, years, perPointFn) {
  const today = new Date()
  const liveProp = properties.filter((p) => p.status !== 'planned')
  return Array.from({ length: years + 1 }, (_, i) => {
    const futureDate = new Date(today.getFullYear() + i, today.getMonth(), 1)
    const futureISO = futureDate.toISOString()
    const label = i === 0 ? 'Now' : `${futureDate.getFullYear()}`
    const value = perPointFn(liveProp, i, futureISO)
    return { label, value: Math.round(value), year: i }
  })
}

function generateNetWorthProjection(properties, personalCash, years = 10) {
  return _projectPoints(properties, years, (liveProp, i, futureISO) => {
    let totalValue = 0
    let totalDebt = 0
    liveProp.forEach((p) => {
      const appRate = (parseFloat(p.appreciationRate) || 3) / 100
      totalValue += (p.currentValue || 0) * Math.pow(1 + appRate, i)
      totalDebt  += (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, futureISO), 0)
    })
    return totalValue - totalDebt + (personalCash || 0)
  })
}

function generateInvestmentReadyProjection(properties, personalCash, years = 10) {
  const LTV = 0.80
  return _projectPoints(properties, years, (liveProp, i, futureISO) => {
    let equity = 0
    liveProp.forEach((p) => {
      const appRate = (parseFloat(p.appreciationRate) || 3) / 100
      const futureVal = (p.currentValue || 0) * Math.pow(1 + appRate, i)
      const futureDebt = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, futureISO), 0)
      equity += Math.max(0, futureVal * LTV - futureDebt)
    })
    return equity + (personalCash || 0)
  })
}

function generateCashFlowProjection(properties, years = 10) {
  return _projectPoints(properties, years, (liveProp, i, futureISO) => {
    let monthlyCF = 0
    liveProp.forEach((p) => {
      const indexRate = (parseFloat(p.indexationRate) || 2) / 100
      const inflRate  = (parseFloat(p.inflationRate)  || 2) / 100
      const rent = (p.startRentalIncome || 0) * Math.pow(1 + indexRate, i)
      const expenses = (
        (p.monthlyExpenses || 0) * Math.pow(1 + inflRate, i) +
        (p.annualMaintenanceCost || 0) / 12 +
        (p.annualInsuranceCost || 0) / 12 +
        (p.annualPropertyTax || 0) / 12
      )
      const loanPayments = (p.loans || []).reduce((s, l) => {
        // loan still running at this future date?
        const bal = getRemainingBalance(l, futureISO)
        return s + (bal > 0 ? (l.monthlyPayment || 0) : 0)
      }, 0)
      monthlyCF += rent - expenses - loanPayments
    })
    return monthlyCF
  })
}

// Chart catalogue
const CHARTS = [
  { id: 'net_worth',        label: 'Net Worth',               sub: 'Appreciation − debt paydown'       },
  { id: 'investment_ready', label: 'Investment Ready Capital', sub: '80% LTV headroom + cash'           },
  { id: 'cashflow',         label: 'Monthly Cash Flow',        sub: 'Rent − expenses − loan payments'   },
]

const SOFT_EASE = [0.22, 1, 0.36, 1]
const cardReveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: SOFT_EASE },
}

function GlowCard({
  children,
  className = '',
  style,
  glowSize = 220,
  glowOpacity = 0.16,
  borderGlowSize = 180,
  borderGlowOpacity = 0.34,
  ...motionProps
}) {
  const [glow, setGlow] = useState({ x: 0, y: 0, active: false })

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    setGlow({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    })
  }

  function handleMouseLeave() {
    setGlow((prev) => ({ ...prev, active: false }))
  }

  return (
    <motion.div
      {...motionProps}
      className={`${className} relative overflow-hidden`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-200"
        style={{
          opacity: glow.active ? 1 : 0,
          background: `radial-gradient(${glowSize}px circle at ${glow.x}px ${glow.y}px, rgba(234,88,12,${glowOpacity}), rgba(234,88,12,0) 72%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] p-px transition-opacity duration-200"
        style={{
          opacity: glow.active ? 1 : 0,
          background: `radial-gradient(${borderGlowSize}px circle at ${glow.x}px ${glow.y}px, rgba(251,146,60,${borderGlowOpacity}), rgba(251,146,60,0) 72%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function WalletIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function CashFlowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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

function TargetIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value, explanation }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <GlowCard
      className="relative border border-white/[0.10] rounded-2xl px-4 py-3 flex-1 min-w-0"
      style={{ background: 'rgba(10, 14, 24, 0.38)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: SOFT_EASE }}
      glowSize={170}
      glowOpacity={0.14}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-600/15 flex items-center justify-center shrink-0 text-brand-400">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-neo-muted truncate">{label}</p>
            <button
              type="button"
              className="sm:hidden text-neo-subtle hover:text-neo-muted transition-colors"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={`Explain ${label}`}
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="hidden sm:inline-flex items-center justify-center text-neo-subtle group relative">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span
                className="pointer-events-none absolute z-20 w-64 left-1/2 -translate-x-1/2 bottom-full mb-2
                           rounded-xl border border-white/[0.12] px-3 py-2 text-xs leading-relaxed text-neo-muted
                           opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ background: 'rgba(8, 12, 22, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              >
                {explanation}
              </span>
            </span>
          </div>
          <p className="text-sm font-bold text-neo-text tabular-nums truncate">{value}</p>
        </div>
      </div>

      <div className={`sm:hidden mt-2 text-[11px] leading-relaxed text-neo-subtle ${expanded ? 'block' : 'hidden'}`}>
        {explanation}
      </div>
    </GlowCard>
  )
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="border border-white/[0.12] rounded-xl px-3 py-2"
      style={{ background: 'rgba(8, 12, 22, 0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      <p className="text-xs text-neo-muted mb-0.5">{label}</p>
      <p className="text-sm font-bold text-brand-400 tabular-nums">
        {kFmt(payload[0]?.value || 0)}{suffix}
      </p>
    </div>
  )
}

// ─── Goal Progress Bar ────────────────────────────────────────────────────────

function GoalBar({ label, pct, color = '#ea580c' }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-neo-muted">{label}</span>
        <span className="text-sm font-semibold text-neo-text tabular-nums">{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 bg-neo-sunken rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full transition-all duration-700"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, ease: SOFT_EASE }}
          style={{
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            boxShadow: `0 0 10px ${color}55`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Radial Gauge ─────────────────────────────────────────────────────────────

function RadialGauge({ pct, label }) {
  const r = 48
  const cx = 70
  const cy = 70
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="#ea580c" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: 'drop-shadow(0 0 8px rgba(234,88,12,0.7))' }}
      />
      {/* Center labels */}
      <text x={cx} y={cy - 6} textAnchor="middle"
            fill="#e2e8f4" fontSize="22" fontWeight="bold" fontFamily="Inter, sans-serif">
        {Math.round(pct)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
            fill="#8897b5" fontSize="11" fontFamily="Inter, sans-serif">
        {label}
      </text>
    </svg>
  )
}

// ─── Portfolio (Investment) Card ──────────────────────────────────────────────

function PortfolioCard({ equity, name }) {
  return (
    <GlowCard
      className="relative rounded-2xl overflow-hidden p-5"
      style={{
        background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 55%, #9a3412 100%)',
        minHeight: '164px',
      }}
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ duration: 0.22, ease: SOFT_EASE }}
      glowSize={260}
      glowOpacity={0.12}
    >
      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute right-4 bottom-0 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative z-10">
        {/* Top row: chip + network logo */}
        <div className="flex justify-between items-start mb-5">
          <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-sm" />
          <div className="flex items-center">
            <div className="w-7 h-7 rounded-full bg-red-400/80 -mr-3 shadow" />
            <div className="w-7 h-7 rounded-full bg-yellow-400/80 shadow" />
          </div>
        </div>

        {/* Balance */}
        <p className="text-white/60 text-[11px] uppercase tracking-wider mb-0.5">Total Equity</p>
        <p className="text-white text-xl font-bold tabular-nums leading-tight">
          {formatEUR(equity)}
        </p>

        {/* Name */}
        <p className="text-white/55 text-xs mt-3 truncate">{name}</p>
      </div>
    </GlowCard>
  )
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ icon, title, sub, amount, positive }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="w-8 h-8 rounded-xl bg-neo-raised/60 flex items-center justify-center shrink-0 text-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neo-text truncate leading-tight">{title}</p>
        <p className="text-xs text-neo-subtle truncate">{sub}</p>
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {amount}
      </span>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAddProperty }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="card text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto mb-4 text-brand-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neo-text mb-2">No Properties Yet</h2>
        <p className="text-neo-muted text-sm mb-5">
          Add your first property to see your Spatial Glass portfolio dashboard.
        </p>
        <button onClick={onAddProperty} className="btn-primary w-full">
          <PlusIcon />
          Add Property
        </button>
      </div>
    </div>
  )
}

// ─── Investment Ready Hero Card ───────────────────────────────────────────────

function InvestmentReadyCard({ total, equityPart, cashPart }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="relative rounded-3xl p-5 overflow-hidden border border-brand-500/20"
      style={{ background: 'linear-gradient(135deg, rgba(234,88,12,0.18) 0%, rgba(194,65,12,0.10) 60%, rgba(10,14,24,0.38) 100%)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 0 40px rgba(234,88,12,0.12), 0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)' }}
    >
      {/* Decorative glow */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%)' }} />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Left: big number */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style={{ boxShadow: '0 0 8px rgba(234,88,12,0.8)' }} />
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Investment Ready Capital</p>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-neo-text tabular-nums leading-none mb-2" style={{ textShadow: '0 0 30px rgba(234,88,12,0.3)' }}>
            {formatEUR(total)}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-neo-muted">Available for your next property acquisition</p>
            {/* Mobile-only expand toggle */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="sm:hidden flex items-center gap-1 text-[10px] text-neo-subtle hover:text-neo-muted transition-colors shrink-0"
            >
              <span>{expanded ? 'less' : 'how?'}</span>
              <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right: breakdown + buy power — always on sm+, collapsible on mobile */}
        <div className={`sm:w-72 shrink-0 space-y-2 sm:block ${expanded ? 'block' : 'hidden'}`}>
          {/* Breakdown with formula */}
          <div className="rounded-2xl px-3 py-2.5 space-y-1.5" style={{ background: 'rgba(4,7,14,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span className="text-xs text-neo-subtle">Reusable property equity</span>
                <p className="text-[10px] text-neo-icon mt-0.5 font-mono">Σ (value × 80%) − debt</p>
              </div>
              <span className="text-xs font-semibold text-neo-text tabular-nums shrink-0">{kFmt(equityPart)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-neo-subtle">Liquid savings</span>
              <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(cashPart)}</span>
            </div>
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-neo-muted">Total ready</span>
              <span className="text-xs font-bold text-brand-400 tabular-nums">{kFmt(total)}</span>
            </div>
            {/* Usage hint */}
            <p className="text-[10px] text-neo-subtle leading-relaxed pt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              Use for: <span className="text-neo-muted">12% registration tax</span> or <span className="text-neo-muted">20% own contribution</span> on next purchase
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Property Equity Row ──────────────────────────────────────────────────────

function PropertyEquityRow({ name, value, debt, headroom, ltvPct }) {
  const ltvColor = ltvPct < 60 ? '#10b981' : ltvPct < 75 ? '#f59e0b' : '#ef4444'
  const maxBorrow = value * 0.80
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neo-text truncate leading-tight">{name}</p>
        {/* Formula: value×80% − debt = headroom */}
        <p className="text-[10px] text-neo-icon font-mono mt-0.5 truncate">
          {kFmt(maxBorrow)} − {kFmt(debt)} = <span style={{ color: '#fb923c' }}>{kFmt(headroom)}</span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-neo-sunken rounded-full overflow-hidden" style={{ maxWidth: '80px' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, ltvPct)}%`, background: ltvColor, boxShadow: `0 0 6px ${ltvColor}66` }} />
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: ltvColor }}>{ltvPct.toFixed(0)}% LTV</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-brand-400 tabular-nums">{kFmt(headroom)}</p>
        <p className="text-[10px] text-neo-subtle">available</p>
      </div>
    </div>
  )
}

function GoalModal({ onClose, onSave, defaultYear, initialGoal = null }) {
  const [targetYear, setTargetYear] = useState(initialGoal?.targetYear ?? defaultYear)
  const [targetCapital, setTargetCapital] = useState(initialGoal?.targetAmount ?? 50000)

  const submit = (e) => {
    e.preventDefault()
    if (!targetYear || targetCapital <= 0) return
    onSave({
      id: initialGoal?.id ?? crypto.randomUUID(),
      type: 'investment_ready_capital',
      targetYear: Number(targetYear),
      targetAmount: Number(targetCapital),
      createdAt: initialGoal?.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: SOFT_EASE }}
    >
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-3xl border border-white/[0.12] p-5 space-y-4"
        style={{ background: 'rgba(8,12,22,0.96)' }}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: SOFT_EASE }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-neo-text">{initialGoal ? 'Edit Goal' : 'Add Goal'}</h3>
            <p className="text-xs text-neo-subtle mt-0.5">Target investment-ready capital by a specific year.</p>
          </div>
          <button type="button" onClick={onClose} className="text-neo-subtle hover:text-neo-text">✕</button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neo-muted">Target year</label>
          <input
            type="number"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 40}
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
            className="input w-full"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neo-muted">Required capital (€)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neo-subtle text-sm">€</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={targetCapital}
              onChange={(e) => setTargetCapital(Number(e.target.value || 0))}
              className="input w-full pl-7"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs rounded-xl border border-white/[0.12] text-neo-muted hover:text-neo-text">
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs">
            {initialGoal ? 'Update Goal' : 'Save Goal'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({
  properties,
  profile,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  onSaveProfile,
  tradingPortfolioValue = 0,
}) {
  const [chartRange, setChartRange]       = useState(10)
  const [chartPickerOpen, setChartPickerOpen] = useState(false)
  const [activeChart, setActiveChart]     = useState(profile?.dashboardChart ?? 'net_worth')
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [goalBeingEdited, setGoalBeingEdited] = useState(null)

  const s = computeSummary(properties, profile, { tradingPortfolioValue })
  const ltv = s.totalPortfolioValue > 0 ? (s.totalDebt / s.totalPortfolioValue) * 100 : null

  // ── Derived values ────────────────────────────────────────

  const healthScore = useMemo(
    () => computeHealthScore(ltv, s.totalMonthlyCashFlow, s.propertyCount),
    [ltv, s.totalMonthlyCashFlow, s.propertyCount]
  )

  const chartData = useMemo(() => {
    if (activeChart === 'investment_ready')
      return generateInvestmentReadyProjection(properties, s.personalCash, chartRange)
    if (activeChart === 'cashflow')
      return generateCashFlowProjection(properties, chartRange)
    return generateNetWorthProjection(properties, s.personalCash, chartRange)
  }, [properties, s.personalCash, chartRange, activeChart])

  function handleChartSelect(id) {
    setActiveChart(id)
    setChartPickerOpen(false)
    if (onSaveProfile && profile) {
      onSaveProfile({ ...profile, dashboardChart: id })
    }
  }

  // Goals: portfolio value progress & monthly cash flow progress
  const valueGoalPct = useMemo(() => {
    if (!s.totalPortfolioValue) return 0
    const target = Math.max(s.totalPortfolioValue * 1.5, 500_000)
    return Math.min(100, (s.totalPortfolioValue / target) * 100)
  }, [s.totalPortfolioValue])

  const cfGoalPct = useMemo(() => {
    const target = 3000
    const cf = s.totalMonthlyCashFlow
    if (cf <= 0) return Math.max(0, ((cf + target) / target) * 33)
    return Math.min(100, (cf / target) * 100)
  }, [s.totalMonthlyCashFlow])

  const ltvGoalPct = useMemo(() => {
    if (ltv === null) return 0
    const target = 60
    if (ltv <= target) return 100
    if (ltv >= 100)    return 0
    return Math.max(0, 100 - ((ltv - target) / (100 - target)) * 100)
  }, [ltv])

  // Profile name for right panel
  const profileName = useMemo(() => {
    if (profile?.members?.length) {
      const me = profile.members.find((m) => m.isMe) ?? profile.members[0]
      if (me?.name) return me.name
    }
    return 'My Portfolio'
  }, [profile])

  const profileInitials = profileName.slice(0, 2).toUpperCase()

  // ── Investment Ready Capital ─────────────────────────────────
  // Belgian 80% LTV rule: max borrowable = currentValue × 0.80
  const LTV_MAX = 0.80
  const availableEquity = useMemo(() => {
    const todayISO = new Date().toISOString()
    return properties
      .filter(p => p.status !== 'planned')
      .reduce((sum, p) => {
        const debt = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, todayISO), 0)
        return sum + Math.max(0, (p.currentValue || 0) * LTV_MAX - debt)
      }, 0)
  }, [properties])

  const liquidCash = s.personalCash || 0
  const investmentReadyCapital = availableEquity + liquidCash

  // Buy power: with investmentReadyCapital as 20% down → max property value × 5
  const buyPowerConservative = investmentReadyCapital * 5   // 20% down
  const buyPowerLeveraged    = investmentReadyCapital * 10  // 10% down
  const capitalGoals = Array.isArray(profile?.capitalGoals) ? profile.capitalGoals : []

  // Per-property equity headroom for breakdown
  const propertyEquityRows = useMemo(() => {
    const todayISO = new Date().toISOString()
    return properties
      .filter(p => p.status !== 'planned')
      .map(p => {
        const debt = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, todayISO), 0)
        const value = p.currentValue || 0
        const maxBorrow = value * LTV_MAX
        const headroom = Math.max(0, maxBorrow - debt)
        const ltvPct = value > 0 ? (debt / value) * 100 : 0
        return { name: p.name || p.address || 'Property', value, debt, headroom, ltvPct }
      })
      .sort((a, b) => b.headroom - a.headroom)
  }, [properties])

  const projectedInvestmentReadyByYear = useMemo(() => {
    const points = generateInvestmentReadyProjection(properties, s.personalCash, 25)
    const map = new Map()
    const nowYear = new Date().getFullYear()
    points.forEach((p) => map.set(nowYear + p.year, p.value))
    return map
  }, [properties, s.personalCash])

  async function handleSaveGoal(goal) {
    if (!onSaveProfile || !profile) return
    const exists = capitalGoals.some((g) => g.id === goal.id)
    const nextGoals = exists
      ? capitalGoals.map((g) => (g.id === goal.id ? { ...g, ...goal } : g))
      : [...capitalGoals, goal]
    await onSaveProfile({ ...profile, capitalGoals: nextGoals })
    setGoalBeingEdited(null)
    setGoalModalOpen(false)
  }

  async function handleDeleteGoal(goalId) {
    if (!onSaveProfile || !profile) return
    const nextGoals = capitalGoals.filter((g) => g.id !== goalId)
    await onSaveProfile({ ...profile, capitalGoals: nextGoals })
  }

  // ── Empty state ────────────────────────────────────────────

  if (properties.length === 0) {
    return <EmptyState onAddProperty={onAddProperty} />
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
    <div className="flex gap-6 min-h-full">

      {/* ══ Main content ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neo-text tracking-tight">My Dashboard</h1>
            <p className="text-sm text-neo-muted mt-0.5">Real estate portfolio overview</p>
          </div>
        </div>

        {/* ── Investment Ready Capital hero ── */}
        <motion.div {...cardReveal}>
          <InvestmentReadyCard
            total={investmentReadyCapital}
            equityPart={availableEquity}
            cashPart={liquidCash}
          />
        </motion.div>

        {/* ── Key Stats ── */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          initial="initial"
          animate="animate"
          variants={{
            initial: {},
            animate: {
              transition: {
                staggerChildren: 0.05,
              },
            },
          }}
        >
          {[
            {
              icon: <WalletIcon />,
              label: 'Net Worth',
              value: formatEUR(s.personalNetWorth),
              explanation: (
                <>
                  <p>Personal net worth includes your share of real-estate equity, plus liquid cash and trading portfolio value.</p>
                  <p className="mt-1.5 font-mono text-[10px] text-neo-icon">
                    {kFmt(s.personalRealEstateNetWorth)} + {kFmt(s.personalCash)} + {kFmt(s.personalTradingValue)}
                  </p>
                </>
              ),
            },
            {
              icon: <CashFlowIcon />,
              label: 'Monthly CF',
              value: formatEUR(s.totalMonthlyCashFlow),
              explanation: (
                <>
                  <p>Monthly cash flow is rent minus operating costs and interest (capital repayment is tracked separately).</p>
                  <p className="mt-1.5 font-mono text-[10px] text-neo-icon">
                    {kFmt(s.annualRentalIncome / 12)} - {kFmt(s.annualOpex / 12)} - {kFmt(s.monthlyInterest)}
                  </p>
                </>
              ),
            },
            {
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              label: 'Portfolio LTV',
              value: ltv !== null ? `${ltv.toFixed(1)}%` : '—',
              explanation: (
                <>
                  <p>Loan-to-value compares total outstanding debt to total portfolio value across live properties.</p>
                  <p className="mt-1.5 font-mono text-[10px] text-neo-icon">
                    ({kFmt(s.totalDebt)} / {kFmt(s.totalPortfolioValue)}) x 100
                  </p>
                </>
              ),
            },
            {
              icon: <HomeIcon />,
              label: 'Properties',
              value: s.propertyCount,
              explanation: 'Count of live properties currently in portfolio metrics (planned entries are excluded).',
            },
          ].map((pill) => (
            <motion.div
              key={pill.label}
              variants={{
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: SOFT_EASE } },
              }}
            >
              <StatPill {...pill} />
            </motion.div>
          ))}
        </motion.div>

        {/* ── Chart + Equity Breakdown ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Projection Chart — switchable */}
          <GlowCard className="card relative" {...cardReveal}>

            {/* ── Header: clickable title + range toggle ── */}
            <div className="flex items-center justify-between mb-4">

              {/* Clickable title → opens chart picker */}
              <button
                onClick={() => setChartPickerOpen(o => !o)}
                className="flex items-start gap-1.5 group text-left"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold text-neo-text group-hover:text-brand-400 transition-colors">
                      {CHARTS.find(c => c.id === activeChart)?.label ?? 'Projection'}
                    </h2>
                    {/* Chevron */}
                    <svg
                      className={`w-3.5 h-3.5 text-neo-subtle group-hover:text-brand-400 transition-all duration-200 ${chartPickerOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <p className="text-xs text-neo-subtle mt-0.5">
                    {CHARTS.find(c => c.id === activeChart)?.sub}
                  </p>
                </div>
              </button>

              {/* Range toggle */}
              <div className="flex gap-1.5 shrink-0">
                {[5, 10, 25].map((y) => (
                  <button
                    key={y}
                    onClick={() => setChartRange(y)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium transition-all
                      ${chartRange === y
                        ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                        : 'text-neo-subtle hover:text-neo-muted border border-transparent'}`}
                  >
                    {y}Y
                  </button>
                ))}
              </div>
            </div>

            {/* ── Chart picker dropdown ── */}
            <AnimatePresence>
            {chartPickerOpen && (
              <motion.div
                className="absolute left-4 top-14 z-20 rounded-2xl border border-white/[0.10] overflow-hidden shadow-2xl"
                style={{ background: 'rgba(8,12,22,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', minWidth: '220px' }}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: SOFT_EASE }}
              >
                {CHARTS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleChartSelect(c.id)}
                    className={`w-full flex flex-col items-start px-4 py-3 text-left transition-colors
                      hover:bg-white/[0.06]
                      ${activeChart === c.id ? 'bg-brand-600/10' : ''}`}
                  >
                    <span className={`text-sm font-medium ${activeChart === c.id ? 'text-brand-400' : 'text-neo-text'}`}>
                      {c.label}
                    </span>
                    <span className="text-[11px] text-neo-subtle mt-0.5">{c.sub}</span>
                  </button>
                ))}
              </motion.div>
            )}
            </AnimatePresence>

            {/* ── End-value badge ── */}
            {chartData.length > 0 && Math.abs(chartData[chartData.length - 1].value) > 0 && (
              <div className="relative h-0">
                <div className="absolute right-14 -top-1 z-10">
                  <div className="bg-brand-600/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-glow-sm">
                    <p className="text-white text-xs font-bold tabular-nums">
                      {activeChart === 'cashflow'
                        ? `${kFmt(chartData[chartData.length - 1].value)}/mo`
                        : kFmt(chartData[chartData.length - 1].value)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Chart ── */}
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 28, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ea580c" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8897b5', fontSize: 11 }} axisLine={false} tickLine={false}
                  interval={chartRange <= 5 ? 0 : Math.floor(chartRange / 5)} />
                <YAxis tickFormatter={activeChart === 'cashflow' ? (v) => `${kFmt(v)}` : kFmt}
                  tick={{ fill: '#8897b5', fontSize: 11 }} axisLine={false} tickLine={false} width={54} />
                <Tooltip content={<ChartTooltip suffix={activeChart === 'cashflow' ? '/mo' : ''} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2.5}
                  fill="url(#valueGrad)" dot={false}
                  activeDot={{ r: 5, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(234,88,12,0.5))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlowCard>

          {/* Equity Headroom per Property */}
          <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.04 }}>
            <h3 className="font-semibold text-neo-text mb-1">Equity Headroom</h3>
            <p className="text-xs text-neo-subtle mb-4">Available borrowing at 80% LTV per property</p>
            {propertyEquityRows.length > 0 ? (
              <div>
                {propertyEquityRows.map((row, i) => (
                  <PropertyEquityRow key={i} {...row} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neo-subtle text-center py-8">No live properties</p>
            )}
            {/* Total bar */}
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center">
              <span className="text-xs text-neo-muted">Total available equity</span>
              <span className="text-sm font-bold text-brand-400 tabular-nums">{kFmt(availableEquity)}</span>
            </div>
          </GlowCard>

        </div>

        {/* ── Cash Flow + Goals ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Cash Flow Breakdown */}
          <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.05 }}>
            <h3 className="font-semibold text-neo-text mb-4">Cash Flow</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                <span className="text-sm text-neo-muted">Rental income</span>
                <span className="text-sm font-semibold text-emerald-400 tabular-nums">+{kFmt(s.annualRentalIncome / 12)}/mo</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                <span className="text-sm text-neo-muted">Interest costs</span>
                <span className="text-sm font-semibold text-red-400 tabular-nums">-{kFmt(s.monthlyInterest)}/mo</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                <span className="text-sm text-neo-muted">Operating costs</span>
                <span className="text-sm font-semibold text-red-400 tabular-nums">-{kFmt(s.annualOpex / 12)}/mo</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-neo-text">Net monthly CF</span>
                <span className={`text-sm font-bold tabular-nums ${s.totalMonthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.totalMonthlyCashFlow >= 0 ? '+' : ''}{formatEUR(s.totalMonthlyCashFlow)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-neo-muted">Capital repaid/mo</span>
                <span className="text-xs font-semibold text-neo-muted tabular-nums">+{kFmt(s.monthlyCapital)}/mo</span>
              </div>
              {s.roe > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neo-muted">Return on Equity (ROE)</span>
                  <span className="text-xs font-semibold text-emerald-400 tabular-nums">{s.roe.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </GlowCard>

          {/* Goals */}
          <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.08 }}>
            <h3 className="font-semibold text-neo-text mb-5">Goals</h3>
            <div className="space-y-4">
              <GoalBar label="Portfolio Value Target" pct={valueGoalPct} color="#ea580c" />
              <GoalBar label="Monthly Cash Flow (€3k)" pct={cfGoalPct} color="#f59e0b" />
              {ltv !== null && <GoalBar label="LTV Reduction (target 60%)" pct={ltvGoalPct} color="#10b981" />}
            </div>
          </GlowCard>

        </div>
      </div>

      {/* ══ Right Panel (xl+) ════════════════════════════════ */}
      <div className="hidden xl:flex flex-col gap-5 w-72 shrink-0 mt-6">

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setGoalBeingEdited(null); setGoalModalOpen(true) }} className="btn-primary w-full text-sm justify-center">
            <TargetIcon />
            Goal
          </button>
          <button onClick={onAddProperty} className="btn-primary w-full text-sm justify-center">
            <PlusIcon />
            Property
          </button>
        </div>

        {/* Portfolio Health */}
        <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.08 }}>
          <h3 className="font-semibold text-neo-text mb-3">Portfolio Health</h3>
          <div className="flex items-center gap-4">
            <RadialGauge pct={healthScore} label={healthLabel(healthScore)} />
            <div className="flex-1 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-neo-muted">Portfolio value</span>
                <span className="text-xs font-medium text-neo-text tabular-nums">{kFmt(s.totalPortfolioValue)}</span>
              </div>
              {ltv !== null && (
                <div className="flex justify-between">
                  <span className="text-xs text-neo-muted">LTV</span>
                  <span className={`text-xs font-semibold tabular-nums ${ltv < 60 ? 'text-emerald-400' : ltv < 80 ? 'text-amber-400' : 'text-red-400'}`}>
                    {ltv.toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-neo-muted">Total debt</span>
                <span className="text-xs font-medium text-red-400 tabular-nums">{kFmt(s.totalDebt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neo-muted">Net worth</span>
                <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(s.personalNetWorth)}</span>
              </div>
            </div>
          </div>
        </GlowCard>

        {/* Buy Power */}
        <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.12 }}>
          <h3 className="font-semibold text-neo-text mb-3">Acquisition Power</h3>
          <p className="text-xs text-neo-subtle mb-4">Based on {kFmt(investmentReadyCapital)} ready capital</p>
          <div className="space-y-3">
            <div className="rounded-2xl px-3 py-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Conservative · 20% down</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{kFmt(buyPowerConservative)}</p>
              <p className="text-[10px] text-neo-subtle mt-0.5">max property value</p>
            </div>
            <div className="rounded-2xl px-3 py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1">Leveraged · 10% down</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums">{kFmt(buyPowerLeveraged)}</p>
              <p className="text-[10px] text-neo-subtle mt-0.5">max property value</p>
            </div>
          </div>
        </GlowCard>

        {/* Goals */}
        <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.16 }}>
          <h3 className="font-semibold text-neo-text mb-3">Goals</h3>
          {capitalGoals.length === 0 ? (
            <p className="text-xs text-neo-subtle">No goals yet. Add one to track target capital by year.</p>
          ) : (
            <div className="space-y-3">
              {capitalGoals.map((g) => {
                const projected = projectedInvestmentReadyByYear.get(Number(g.targetYear)) ?? investmentReadyCapital
                const pct = Math.max(0, Math.min(100, (projected / (g.targetAmount || 1)) * 100))
                const currentPct = Math.max(0, Math.min(100, (investmentReadyCapital / (g.targetAmount || 1)) * 100))
                const remaining = Math.max(0, g.targetAmount - projected)
                return (
                  <div key={g.id} className="group rounded-2xl px-3 py-3 border border-white/[0.08]" style={{ background: 'rgba(4,7,14,0.35)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-neo-muted">By {g.targetYear}: {kFmt(g.targetAmount)} ready capital</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neo-text tabular-nums">{Math.round(pct)}%</span>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => { setGoalBeingEdited(g); setGoalModalOpen(true) }}
                            className="w-6 h-6 rounded-lg text-neo-subtle hover:text-brand-300 hover:bg-white/[0.06] transition-colors flex items-center justify-center"
                            title="Edit goal"
                            aria-label="Edit goal"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(g.id)}
                            className="w-6 h-6 rounded-lg text-neo-subtle hover:text-red-400 hover:bg-white/[0.06] transition-colors flex items-center justify-center"
                            title="Delete goal"
                            aria-label="Delete goal"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative h-2 bg-neo-sunken rounded-full mt-2 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-l-full"
                        style={{ width: `${Math.min(currentPct, pct)}%`, background: '#10b981' }}
                      />
                      {pct > currentPct && (
                        <div
                          className="absolute top-0 h-full"
                          style={{
                            left: `${currentPct}%`,
                            width: `${pct - currentPct}%`,
                            background: 'linear-gradient(90deg, #ea580c, #f59e0b)',
                          }}
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-neo-subtle mt-2">
                      Current: <span className="text-neo-muted">{kFmt(investmentReadyCapital)}</span>
                      {' · '}
                      Projected: <span className="text-neo-muted">{kFmt(projected)}</span>
                      {' · '}
                      {remaining > 0
                        ? <>Gap: <span className="text-red-400">{kFmt(remaining)}</span></>
                        : <span className="text-emerald-400">On track</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </GlowCard>

        {/* Profile card */}
        <GlowCard className="card" {...cardReveal} transition={{ duration: 0.3, ease: SOFT_EASE, delay: 0.2 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-brand-600/15 border border-brand-500/20
                            flex items-center justify-center text-brand-400 font-bold shrink-0">
              {profileInitials}
            </div>
            <div>
              <p className="font-semibold text-neo-text text-sm leading-snug">{profileName}</p>
              <p className="text-xs text-neo-muted">{s.propertyCount} propert{s.propertyCount === 1 ? 'y' : 'ies'} · {s.activeRentalCount} rented</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-neo-muted">Liquid cash</span>
              <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(liquidCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-neo-muted">Equity headroom</span>
              <span className="text-xs font-semibold text-brand-400 tabular-nums">{kFmt(availableEquity)}</span>
            </div>
            {s.personalTradingValue > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-neo-muted">Trading portfolio</span>
                <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(s.personalTradingValue)}</span>
              </div>
            )}
          </div>
        </GlowCard>

      </div>
    </div>
    <AnimatePresence>
      {goalModalOpen && (
        <GoalModal
          onClose={() => setGoalModalOpen(false)}
          onSave={handleSaveGoal}
          defaultYear={new Date().getFullYear() + 3}
          initialGoal={goalBeingEdited}
        />
      )}
    </AnimatePresence>
    </>
  )
}
