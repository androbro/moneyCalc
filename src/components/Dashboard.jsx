import { useMemo, useState } from 'react'
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

function generateChartData(properties, totalValue, months = 6) {
  const today = new Date()
  const liveProp = properties.filter((p) => p.status !== 'planned')

  if (!totalValue || liveProp.length === 0) {
    return Array.from({ length: months + 1 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (months - i), 1)
      return { month: d.toLocaleString('default', { month: 'short' }), value: 0 }
    })
  }

  const avgMonthlyRate =
    liveProp.reduce((sum, p) => sum + (parseFloat(p.appreciationRate) || 3), 0) /
    liveProp.length / 100 / 12

  return Array.from({ length: months + 1 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (months - i), 1)
    const monthsBack = months - i
    const value = Math.round(totalValue / Math.pow(1 + avgMonthlyRate, monthsBack))
    return { month: d.toLocaleString('default', { month: 'short' }), value }
  })
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

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }) {
  return (
    <div
      className="flex items-center gap-3 border border-white/[0.10] rounded-2xl px-4 py-3 flex-1 min-w-0"
      style={{ background: 'rgba(10, 14, 24, 0.38)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      <div className="w-9 h-9 rounded-xl bg-brand-600/15 flex items-center justify-center
                      shrink-0 text-brand-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neo-muted truncate">{label}</p>
        <p className="text-sm font-bold text-neo-text tabular-nums truncate">{value}</p>
      </div>
    </div>
  )
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="border border-white/[0.12] rounded-xl px-3 py-2"
      style={{ background: 'rgba(8, 12, 22, 0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      <p className="text-xs text-neo-muted mb-0.5">{label}</p>
      <p className="text-sm font-bold text-brand-400 tabular-nums">
        {kFmt(payload[0]?.value || 0)}
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
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${clamped}%`,
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
    <div
      className="relative rounded-2xl overflow-hidden p-5"
      style={{
        background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 55%, #9a3412 100%)',
        minHeight: '164px',
      }}
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
    </div>
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({
  properties,
  profile,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  tradingPortfolioValue = 0,
}) {
  const [chartRange, setChartRange] = useState(6)

  const s = computeSummary(properties, profile, { tradingPortfolioValue })
  const ltv = s.totalPortfolioValue > 0 ? (s.totalDebt / s.totalPortfolioValue) * 100 : null

  // ── Derived values ────────────────────────────────────────

  const healthScore = useMemo(
    () => computeHealthScore(ltv, s.totalMonthlyCashFlow, s.propertyCount),
    [ltv, s.totalMonthlyCashFlow, s.propertyCount]
  )

  const chartData = useMemo(
    () => generateChartData(properties, s.totalPortfolioValue, chartRange),
    [properties, s.totalPortfolioValue, chartRange]
  )

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

  // Right panel: top properties by current value
  const propertyRows = useMemo(() => {
    const todayISO = new Date().toISOString()
    return [...properties]
      .filter((p) => p.status !== 'planned')
      .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
      .slice(0, 4)
      .map((p) => {
        const debt = (p.loans || []).reduce(
          (sum, l) => sum + getRemainingBalance(l, todayISO),
          0
        )
        const equity = (p.currentValue || 0) - debt
        const isRented = isRentalActiveOn(p, new Date())
        return {
          icon: isRented ? '🏘' : '🏠',
          title: p.name || p.address || 'Property',
          sub: isRented ? 'Rental income' : 'Owner occupied',
          amount: formatEUR(equity),
          positive: equity >= 0,
        }
      })
  }, [properties])

  // Profile name for right panel
  const profileName = useMemo(() => {
    if (profile?.members?.length) {
      const me = profile.members.find((m) => m.isMe) ?? profile.members[0]
      if (me?.name) return me.name
    }
    return 'My Portfolio'
  }, [profile])

  const profileInitials = profileName.slice(0, 2).toUpperCase()

  // ── Empty state ────────────────────────────────────────────

  if (properties.length === 0) {
    return <EmptyState onAddProperty={onAddProperty} />
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex gap-6 min-h-full">

      {/* ══ Main content ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neo-text tracking-tight">My Dashboard</h1>
            <p className="text-sm text-neo-muted mt-0.5">Real estate portfolio overview</p>
          </div>
          <button onClick={onAddProperty} className="btn-primary">
            <PlusIcon />
            Add Property
          </button>
        </div>

        {/* Stat Pills */}
        <div className="flex flex-col sm:flex-row gap-3">
          <StatPill
            icon={<WalletIcon />}
            label="Net Worth"
            value={formatEUR(s.personalNetWorth)}
          />
          <StatPill
            icon={<CashFlowIcon />}
            label="Monthly Cash Flow"
            value={formatEUR(s.totalMonthlyCashFlow)}
          />
          <StatPill
            icon={<HomeIcon />}
            label="Properties Owned"
            value={s.propertyCount}
          />
        </div>

        {/* ── Portfolio Growth Chart ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-neo-text">Statistic</h2>
              <p className="text-xs text-neo-subtle mt-0.5">Portfolio Growth</p>
            </div>
            <div className="flex gap-1.5">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setChartRange(m)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all
                    ${chartRange === m
                      ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                      : 'text-neo-subtle hover:text-neo-muted border border-transparent'}`}
                >
                  {m === 12 ? '1Y' : `${m}M`}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
              <span className="text-xs text-neo-muted">Total Value</span>
            </div>
          </div>

          {/* Peak label */}
          {chartData.length > 0 && chartData[chartData.length - 1].value > 0 && (
            <div className="relative h-0">
              <div className="absolute right-14 -top-1 z-10">
                <div className="bg-brand-600/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-glow-sm">
                  <p className="text-white text-xs font-bold tabular-nums">
                    {kFmt(chartData[chartData.length - 1].value)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 28, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ea580c" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8897b5', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={kFmt}
                tick={{ fill: '#8897b5', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ea580c"
                strokeWidth={2.5}
                fill="url(#valueGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
                style={{ filter: 'drop-shadow(0 0 6px rgba(234,88,12,0.5))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Goals + Health ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* My Goals */}
          <div className="card">
            <h3 className="font-semibold text-neo-text mb-5">My Goals</h3>
            <div className="space-y-4">
              <GoalBar
                label="Portfolio Value Target"
                pct={valueGoalPct}
                color="#ea580c"
              />
              <GoalBar
                label="Monthly Cash Flow (€3k)"
                pct={cfGoalPct}
                color="#f59e0b"
              />
              {ltv !== null && (
                <GoalBar
                  label="LTV Reduction (target 60%)"
                  pct={ltvGoalPct}
                  color="#10b981"
                />
              )}
            </div>
          </div>

          {/* Portfolio Health */}
          <div className="card">
            <h3 className="font-semibold text-neo-text mb-3">Portfolio Health</h3>
            <div className="flex items-center gap-4">
              <RadialGauge pct={healthScore} label={healthLabel(healthScore)} />
              <div className="flex-1 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-xs text-neo-muted">Target Value</span>
                  <span className="text-xs font-medium text-neo-text tabular-nums">
                    {kFmt(Math.max(s.totalPortfolioValue * 1.5, 500_000))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-neo-muted">Current Value</span>
                  <span className="text-xs font-medium text-neo-text tabular-nums">
                    {kFmt(s.totalPortfolioValue)}
                  </span>
                </div>
                {ltv !== null && (
                  <div className="flex justify-between">
                    <span className="text-xs text-neo-muted">LTV Ratio</span>
                    <span className={`text-xs font-semibold tabular-nums ${
                      ltv < 60 ? 'text-emerald-400' : ltv < 80 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {ltv.toFixed(1)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-xs text-neo-muted">Total Debt</span>
                  <span className="text-xs font-medium text-red-400 tabular-nums">
                    {kFmt(s.totalDebt)}
                  </span>
                </div>
                {s.roe > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-neo-muted">ROE</span>
                    <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                      {s.roe.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══ Right Panel (xl+) ════════════════════════════════ */}
      <div className="hidden xl:flex flex-col gap-5 w-72 shrink-0">

        {/* Profile card */}
        <div className="card">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-600/15 border border-brand-500/20
                              flex items-center justify-center text-brand-400 font-bold text-lg shrink-0">
                {profileInitials}
              </div>
              <div>
                <p className="font-semibold text-neo-text leading-snug">{profileName}</p>
                <p className="text-xs text-neo-muted">
                  {s.propertyCount} propert{s.propertyCount === 1 ? 'y' : 'ies'}
                </p>
              </div>
            </div>
            <button className="text-neo-subtle hover:text-neo-muted transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Add',    icon: '＋',  action: onAddProperty },
              { label: 'Edit',   icon: '✏',  action: null },
              { label: 'Report', icon: '↗',  action: null },
              { label: 'Share',  icon: '⬡',  action: null },
            ].map(({ label, icon, action }) => (
              <button
                key={label}
                onClick={action || undefined}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-11 h-11 rounded-2xl bg-neo-raised/60 border border-white/[0.06]
                                flex items-center justify-center text-neo-muted
                                group-hover:text-brand-400 group-hover:bg-brand-600/10
                                group-hover:border-brand-500/20 transition-all text-base">
                  {icon}
                </div>
                <span className="text-[10px] text-neo-subtle group-hover:text-neo-muted transition-colors">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Investment Card */}
        <div className="card !p-4">
          <h3 className="text-sm font-semibold text-neo-text mb-3">Investment Card</h3>
          <PortfolioCard equity={s.totalNetWorth} name={profileName} />
          <div className="mt-3 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-neo-subtle">Total Balance</p>
              <p className="text-sm font-bold text-neo-text tabular-nums">
                {formatEUR(s.totalNetWorth)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-neo-subtle">Properties</p>
              <p className="text-sm font-bold text-neo-text">{s.propertyCount}</p>
            </div>
          </div>
        </div>

        {/* Month Transactions */}
        <div className="card flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-neo-text">Top Properties</h3>
            <button
              onClick={() => onEditProperty && properties[0] && onEditProperty(properties[0])}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              See all
            </button>
          </div>
          <div>
            {propertyRows.length > 0 ? (
              propertyRows.map((row, i) => <TransactionRow key={i} {...row} />)
            ) : (
              <p className="text-xs text-neo-subtle text-center py-4">No properties yet</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
