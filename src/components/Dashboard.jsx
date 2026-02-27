import { computeSummary, formatEUR } from '../utils/projectionUtils'

function StatCard({ label, value, sub, color = 'text-white', icon }) {
  return (
    <div className="card flex items-start gap-4">
      {icon && (
        <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-brand-400">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="stat-label">{label}</p>
        <p className={`stat-value ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function PropertyCard({ property, onEdit, onDelete }) {
  const totalLoans = (property.loans || []).reduce((sum, l) => {
    const last = l.amortizationSchedule?.at(-1)
    return sum + (last ? 0 : (l.originalAmount || 0))
  }, 0)

  const equity = property.currentValue - totalLoans
  const monthlyCF =
    (property.monthlyRentalIncome || 0) -
    (property.monthlyExpenses || 0) -
    (property.loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0)

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{property.name}</h3>
          <p className="text-xs text-slate-400 truncate">{property.address}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(property)}
            className="text-slate-400 hover:text-brand-400 transition-colors"
            title="Edit"
          >
            <EditIcon />
          </button>
          <button
            onClick={() => onDelete(property.id)}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-400">Current Value</p>
          <p className="font-semibold text-white">{formatEUR(property.currentValue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Equity</p>
          <p className={`font-semibold ${equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatEUR(equity)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Monthly CF</p>
          <p className={`font-semibold ${monthlyCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatEUR(monthlyCF)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Appreciation</p>
          <p className="font-semibold text-white">
            {((property.appreciationRate || 0.02) * 100).toFixed(1)}% / yr
          </p>
        </div>
      </div>

      {(property.loans || []).length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs font-medium text-slate-400 mb-2">
            Loans ({property.loans.length})
          </p>
          <div className="space-y-1.5">
            {property.loans.map((loan) => (
              <div key={loan.id} className="flex justify-between text-sm">
                <span className="text-slate-300">{loan.lender}</span>
                <span className="text-slate-400">
                  {formatEUR(loan.originalAmount)} @ {(loan.interestRate * 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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

export default function Dashboard({ properties, onAddProperty, onEditProperty, onDeleteProperty }) {
  const summary = computeSummary(properties)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real estate portfolio overview</p>
        </div>
        <button onClick={onAddProperty} className="btn-primary">
          <PlusIcon />
          Add Property
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Net Worth"
          value={formatEUR(summary.totalNetWorth)}
          color={summary.totalNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={<NetWorthIcon />}
        />
        <StatCard
          label="Total Assets"
          value={formatEUR(summary.totalAssets)}
          sub={`${summary.propertyCount} propert${summary.propertyCount === 1 ? 'y' : 'ies'}`}
          icon={<AssetsIcon />}
        />
        <StatCard
          label="Total Liabilities"
          value={formatEUR(summary.totalLiabilities)}
          sub={`${summary.loanCount} loan${summary.loanCount === 1 ? '' : 's'}`}
          color="text-red-400"
          icon={<LiabIcon />}
        />
        <StatCard
          label="Monthly Cash Flow"
          value={formatEUR(summary.totalMonthlyCashFlow)}
          color={summary.totalMonthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={<CashFlowIcon />}
        />
      </div>

      {/* Properties grid */}
      <div>
        <h2 className="section-title">Properties</h2>
        {properties.length === 0 ? (
          <EmptyState onAdd={onAddProperty} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                onEdit={onEditProperty}
                onDelete={onDeleteProperty}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

function AssetsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function LiabIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
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
