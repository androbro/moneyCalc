import { computeSummary, formatEUR } from '../utils/projectionUtils'

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueColor = 'text-white', icon, trend }) {
  return (
    <div className="card flex items-start gap-4">
      {icon && (
        <div className="shrink-0 w-11 h-11 rounded-xl bg-slate-700/80 flex items-center justify-center text-brand-400">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="stat-label">{label}</p>
        <p className={`stat-value leading-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0
              ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            }
            {Math.abs(trend).toFixed(1)}% ROE
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Property card ────────────────────────────────────────────────────────────

function PropertyCard({ property, onEdit, onDelete }) {
  const today = new Date()
  const currentLoanBalance = (property.loans || []).reduce((sum, l) => {
    if (l.amortizationSchedule?.length > 0) {
      const past = l.amortizationSchedule
        .filter((e) => new Date(e.dueDate) <= today)
        .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
      return sum + (past.length > 0 ? Math.max(0, past[0].remainingBalance) : l.originalAmount)
    }
    return sum + (l.originalAmount || 0)
  }, 0)

  const equity = property.currentValue - currentLoanBalance
  const monthlyIncome = property.startRentalIncome || property.monthlyRentalIncome || 0
  const monthlyCosts =
    (property.monthlyExpenses || 0) +
    ((property.annualMaintenanceCost || 0) + (property.annualInsuranceCost || 0)) / 12 +
    (property.loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0)
  const monthlyCF = monthlyIncome - monthlyCosts

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{property.name}</h3>
          {property.address && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{property.address}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onEdit(property)}
            className="text-slate-400 hover:text-brand-400 transition-colors" title="Edit">
            <EditIcon />
          </button>
          <button onClick={() => onDelete(property.id)}
            className="text-slate-400 hover:text-red-400 transition-colors" title="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Market Value"   value={formatEUR(property.currentValue)} />
        <Metric label="Equity"         value={formatEUR(equity)}
          color={equity >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <Metric label="Monthly CF"     value={formatEUR(monthlyCF)}
          color={monthlyCF >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <Metric label="Appreciation"   value={`${((property.appreciationRate || 0.02) * 100).toFixed(1)}% / yr`} />
        <Metric label="Rent / mo"      value={formatEUR(monthlyIncome)} />
        <Metric label="Rent index"     value={`${((property.indexationRate ?? 0.02) * 100).toFixed(1)}% / yr`}
          color="text-slate-300" />
      </div>

      {(property.loans || []).length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs font-medium text-slate-400 mb-2">
            Loans ({property.loans.length})
          </p>
          <div className="space-y-1.5">
            {property.loans.map((loan) => (
              <div key={loan.id} className="flex justify-between text-sm gap-2">
                <span className="text-slate-300 truncate">{loan.lender}</span>
                <span className="text-slate-400 whitespace-nowrap shrink-0">
                  {formatEUR(loan.originalAmount)} @ {(loan.interestRate * 100).toFixed(2)}%
                  {loan.amortizationSchedule?.length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded-full">
                      CSV
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, color = 'text-white' }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-semibold text-sm ${color}`}>{value}</p>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <p className="text-slate-300 font-medium">No properties yet</p>
      <p className="text-slate-500 text-sm mt-1 mb-4">Add your first property to get started</p>
      <button onClick={onAdd} className="btn-primary">
        <PlusIcon />
        Add Property
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard({ properties, onAddProperty, onEditProperty, onDeleteProperty }) {
  const s = computeSummary(properties)

  const ltv = s.totalPortfolioValue > 0 ? (s.totalDebt / s.totalPortfolioValue) * 100 : null
  const grossYield = s.totalPortfolioValue > 0 ? (s.annualNetCashFlow / s.totalPortfolioValue) * 100 : null

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real estate portfolio overview</p>
        </div>
        <button onClick={onAddProperty} className="btn-primary">
          <PlusIcon />
          Add Property
        </button>
      </div>

      {/* ── Primary KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Portfolio Value"
          value={formatEUR(s.totalPortfolioValue)}
          sub={`${s.propertyCount} propert${s.propertyCount === 1 ? 'y' : 'ies'}`}
          icon={<BuildingIcon />}
        />
        <KpiCard
          label="Total Debt"
          value={formatEUR(s.totalDebt)}
          sub={`${s.loanCount} loan${s.loanCount === 1 ? '' : 's'}`}
          valueColor="text-red-400"
          icon={<DebtIcon />}
        />
        <KpiCard
          label="Net Worth"
          value={formatEUR(s.totalNetWorth)}
          valueColor={s.totalNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={<NetWorthIcon />}
        />
        <KpiCard
          label="Net Cash Flow (Monthly)"
          value={formatEUR(s.totalMonthlyCashFlow)}
          valueColor={s.totalMonthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}
          sub={`${formatEUR(s.annualNetCashFlow)} / year`}
          trend={s.roe}
          icon={<CashFlowIcon />}
        />
      </div>

      {/* ── Secondary metrics strip ── */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card text-center py-4">
            <p className="text-xs text-slate-400 mb-1">Loan-to-Value (LTV)</p>
            <p className={`text-xl font-bold ${
              ltv === null ? 'text-slate-400'
              : ltv > 80 ? 'text-red-400'
              : ltv > 60 ? 'text-orange-400'
              : 'text-emerald-400'
            }`}>
              {ltv !== null ? `${ltv.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">debt / portfolio value</p>
          </div>

          <div className="card text-center py-4">
            <p className="text-xs text-slate-400 mb-1">Return on Equity (ROE)</p>
            <p className={`text-xl font-bold ${s.roe >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {s.totalNetWorth > 0 ? `${s.roe.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">annual net CF / equity</p>
          </div>

          <div className="card text-center py-4">
            <p className="text-xs text-slate-400 mb-1">Net Yield</p>
            <p className={`text-xl font-bold ${
              grossYield === null ? 'text-slate-400'
              : grossYield >= 0 ? 'text-brand-400'
              : 'text-red-400'
            }`}>
              {grossYield !== null ? `${grossYield.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">annual net CF / portfolio value</p>
          </div>
        </div>
      )}

      {/* ── Property cards ── */}
      <div>
        <h2 className="section-title">Properties</h2>
        {properties.length === 0 ? (
          <EmptyState onAdd={onAddProperty} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p}
                onEdit={onEditProperty} onDelete={onDeleteProperty} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function DebtIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  )
}

function NetWorthIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CashFlowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
