/**
 * SharedPortfolioPage.jsx
 *
 * Public read-only portfolio viewer, accessible at /share/:token.
 * Fetches data via the `get_shared_portfolio` Postgres RPC (no auth required).
 * Renders only the tab groups the owner has enabled in their permissions.
 */

import { useState, useEffect } from 'react'
import { getSharedPortfolio } from '../services/portfolioService'
import Dashboard from './Dashboard'
import ProjectionChart from './ProjectionChart'
import CashFlowAggregator from './CashFlowAggregator'
import PropertyDetail from './PropertyDetail'
import GrowthPlanner from './GrowthPlanner'

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard',   label: 'Dashboard',    permKey: 'dashboard'  },
  { id: 'properties',  label: 'Properties',   permKey: 'properties' },
  { id: 'projection',  label: 'Projection',   permKey: 'financials' },
  { id: 'cashflow',    label: 'Cash Flow',    permKey: 'financials' },
  { id: 'investments', label: 'Investments',  permKey: 'financials' },
  { id: 'growth',      label: 'Growth Planner', permKey: 'financials' },
  { id: 'household',   label: 'Household',    permKey: 'household'  },
]

export default function SharedPortfolioPage({ token }) {
  const [data, setData]           = useState(null)   // { permissions, properties, household }
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [activeTab, setActiveTab] = useState(null)
  const [detailProp, setDetailProp] = useState(null)

  useEffect(() => {
    getSharedPortfolio(token)
      .then(result => {
        if (!result) { setNotFound(true); return }
        setData(result)
        // Pick the first enabled tab as default
        const first = TABS.find(t => result.permissions[t.permKey])
        if (first) setActiveTab(first.id)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <LoadingScreen />
  if (notFound) return <NotFoundScreen />

  const { permissions, properties, household, growthPlanner } = data
  const visibleTabs = TABS.filter(t => permissions[t.permKey])

  // Deduplicate tabs that share the same permKey (financials has 3)
  // but keep all — we want separate tabs for Projection / Cash Flow / Investments
  const noop = () => {}

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-white">MoneyCalc</span>
            <span className="hidden sm:inline text-slate-600 text-sm">·</span>
            <span className="hidden sm:inline text-slate-400 text-sm">Shared portfolio</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
              Read-only
            </span>
            <a
              href="/"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
            >
              Open app
            </a>
          </div>
        </div>

        {/* Tab nav */}
        {visibleTabs.length > 1 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 pb-0 overflow-x-auto scrollbar-hide">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setDetailProp(null) }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
                            border-b-2 -mb-px
                            ${activeTab === tab.id
                              ? 'border-brand-500 text-white'
                              : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <Dashboard
            properties={properties}
            profile={household}
            onAddProperty={noop}
            onEditProperty={noop}
            onDeleteProperty={noop}
            readOnly
          />
        )}

        {/* Properties */}
        {activeTab === 'properties' && !detailProp && (
          <ReadOnlyPropertyList
            properties={properties}
            onSelect={setDetailProp}
          />
        )}
        {activeTab === 'properties' && detailProp && (
          <PropertyDetail
            property={properties.find(p => p.id === detailProp) ?? properties[0]}
            onEdit={noop}
            onBack={() => setDetailProp(null)}
            readOnly
          />
        )}

        {/* Projection */}
        {activeTab === 'projection' && (
          <ProjectionChart properties={properties} profile={household} trades={[]} tradingPortfolioValue={0} />
        )}

        {/* Cash flow */}
        {activeTab === 'cashflow' && (
          <CashFlowAggregator
            properties={properties}
            profile={household}
            onEditProfile={noop}
            readOnly
          />
        )}

        {/* Investments */}
        {activeTab === 'investments' && (
          <ReadOnlyInvestments properties={properties} />
        )}

        {/* Growth planner */}
        {activeTab === 'growth' && (
          <GrowthPlanner
            properties={properties}
            profile={household}
            initialPlan={growthPlanner}
          />
        )}

        {/* Household */}
        {activeTab === 'household' && (
          <ReadOnlyHousehold profile={household} />
        )}

      </main>
    </div>
  )
}

// ── Read-only sub-components ──────────────────────────────────────────────────

function ReadOnlyPropertyList({ properties, onSelect }) {
  const fmt = n => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  if (!properties.length) {
    return (
      <div className="card text-center py-16">
        <p className="text-slate-400">No properties in this portfolio.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Properties</h1>
        <p className="text-slate-400 text-sm mt-0.5">{properties.length} {properties.length === 1 ? 'property' : 'properties'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map(p => {
          const totalLoanBalance = (p.loans || []).reduce((s, l) => s + (l.currentBalance ?? 0), 0)
          const equity = (p.currentValue || p.purchasePrice || 0) - totalLoanBalance
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="card text-left hover:border-brand-600/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-brand-900/50 border border-brand-700/40
                                flex items-center justify-center text-brand-400 text-lg shrink-0">
                  🏠
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                  ${p.isPrimaryResidence
                                    ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                                    : p.isRented
                                      ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                                      : 'bg-slate-700 text-slate-400'}`}>
                  {p.isPrimaryResidence ? 'Primary residence' : p.isRented ? 'Rented' : 'Vacant'}
                </span>
              </div>
              <p className="font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
                {p.name}
              </p>
              {p.address && (
                <p className="text-xs text-slate-500 truncate mt-0.5">{p.address}</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Value</p>
                  <p className="text-sm font-semibold text-white">{fmt(p.currentValue || p.purchasePrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Equity</p>
                  <p className={`text-sm font-semibold ${equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(equity)}
                  </p>
                </div>
                {p.startRentalIncome > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Monthly rent</p>
                    <p className="text-sm font-semibold text-white">{fmt(p.startRentalIncome)}</p>
                  </div>
                )}
                {p.loans?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Loan balance</p>
                    <p className="text-sm font-semibold text-red-400">{fmt(totalLoanBalance)}</p>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReadOnlyInvestments({ properties }) {
  const fmt = n => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const today = new Date()

  const allInvestments = properties
    .flatMap(p => (p.plannedInvestments || []).map(inv => ({ ...inv, propertyName: p.name })))
    .sort((a, b) => (a.targetYear ?? 0) - (b.targetYear ?? 0))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Planned Investments</h1>
        <p className="text-slate-400 text-sm mt-0.5">Capital outlays planned across the portfolio</p>
      </div>

      {allInvestments.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400">No planned investments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allInvestments.map(inv => {
            const date = inv.targetYear
              ? new Date(inv.targetYear, (inv.targetMonth ?? 1) - 1, 1)
              : null
            const isPast = date && date < today
            const yearOffset = date
              ? Math.round((date - today) / (365.25 * 24 * 60 * 60 * 1000))
              : null
            const net = (inv.valueIncrease ?? 0) - (inv.cost ?? inv.amount ?? 0)

            return (
              <div key={inv.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={`shrink-0 rounded-xl px-3 py-2 text-center min-w-[72px]
                                ${isPast ? 'bg-slate-700/50' : 'bg-amber-900/30 border border-amber-700/40'}`}>
                  {date ? (
                    <>
                      <p className="text-xs text-slate-400 leading-tight">
                        {date.toLocaleDateString('nl-BE', { month: 'short', year: 'numeric' })}
                      </p>
                      <p className={`text-sm font-bold ${isPast ? 'text-slate-400' : 'text-amber-300'}`}>
                        {isPast ? 'Past' : yearOffset === 0 ? 'This year' : `+${yearOffset}y`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">TBD</p>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {inv.description || 'Unnamed investment'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{inv.propertyName}</p>
                </div>
                <div className="flex gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-xs text-slate-500">Cost</p>
                    <p className="text-sm font-semibold text-red-400">-{fmt(inv.cost ?? inv.amount ?? 0)}</p>
                  </div>
                  {inv.valueIncrease != null && (
                    <div>
                      <p className="text-xs text-slate-500">Value +</p>
                      <p className="text-sm font-semibold text-emerald-400">+{fmt(inv.valueIncrease)}</p>
                    </div>
                  )}
                  {inv.valueIncrease != null && (
                    <div>
                      <p className="text-xs text-slate-500">Net</p>
                      <p className={`text-sm font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {net >= 0 ? '+' : ''}{fmt(net)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReadOnlyHousehold({ profile }) {
  const fmt = n => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const members = profile?.members ?? []
  const totalIncome = members.reduce((s, m) => s + (m.netIncome ?? 0) + (m.investmentIncome ?? 0), 0)
  const totalCash   = members.reduce((s, m) => s + (m.cash ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Household Profile</h1>
        <p className="text-slate-400 text-sm mt-0.5">Income, savings and household expenses</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Monthly income" value={fmt(totalIncome)} />
        <StatCard label="Monthly expenses" value={fmt(profile?.householdExpenses ?? 0)} />
        <StatCard label="Savings rate" value={`${Math.round((profile?.personalSavingsRate ?? 0) * 100)}%`} />
      </div>

      {totalCash > 0 && (
        <div className="card">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Available cash</p>
          <p className="text-2xl font-bold text-white">{fmt(totalCash)}</p>
        </div>
      )}

      {members.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Members</p>
          {members.map(m => (
            <div key={m.id} className="card flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3 min-w-[120px]">
                <div className="w-9 h-9 rounded-full bg-brand-900/50 border border-brand-700/40
                                flex items-center justify-center text-brand-300 font-semibold text-sm">
                  {(m.name ?? 'M').charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-white">{m.name ?? 'Member'}</span>
              </div>
              <div className="flex gap-6 text-right ml-auto flex-wrap">
                {m.netIncome > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Net income</p>
                    <p className="text-sm font-semibold text-white">{fmt(m.netIncome)}</p>
                  </div>
                )}
                {m.investmentIncome > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Investment income</p>
                    <p className="text-sm font-semibold text-emerald-400">{fmt(m.investmentIncome)}</p>
                  </div>
                )}
                {m.cash > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Cash</p>
                    <p className="text-sm font-semibold text-white">{fmt(m.cash)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Loading portfolio…</p>
      </div>
    </div>
  )
}

function NotFoundScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Link not found</h2>
          <p className="text-slate-400 text-sm mt-1">
            This share link doesn't exist or has been revoked by the owner.
          </p>
        </div>
        <a href="/" className="inline-block text-sm text-brand-400 hover:text-brand-300 transition-colors font-medium">
          Go to MoneyCalc
        </a>
      </div>
    </div>
  )
}
