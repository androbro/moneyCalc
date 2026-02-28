import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ProjectionChart from './components/ProjectionChart'
import PropertyForm from './components/PropertyForm'
import PlannedInvestmentForm from './components/PlannedInvestmentForm'
import ScenarioPlanner from './components/ScenarioPlanner'
import HouseholdForm from './components/HouseholdForm'
import CashFlowAggregator from './components/CashFlowAggregator'
import PropertySimulator from './components/PropertySimulator'
import MoneyFlow from './components/MoneyFlow'
import PropertyDetail from './components/PropertyDetail'
import AiChatOverlay from './components/AiChatOverlay'
import AuthOverlay from './components/AuthOverlay'
import { isOwner, isLocalhost, login, logout } from './lib/auth'
import {
  seedGuestStorage,
  getPortfolio      as guestGetPortfolio,
  addProperty       as guestAddProperty,
  updateProperty    as guestUpdateProperty,
  deleteProperty    as guestDeleteProperty,
  addPlannedInvestment    as guestAddPlannedInvestment,
  updatePlannedInvestment as guestUpdatePlannedInvestment,
  deletePlannedInvestment as guestDeletePlannedInvestment,
  getHouseholdProfile  as guestGetHouseholdProfile,
  saveHouseholdProfile as guestSaveHouseholdProfile,
  getSimulatorProfile  as guestGetSimulatorProfile,
  saveSimulatorProfile as guestSaveSimulatorProfile,
} from './lib/guestStorage'
import {
  getPortfolio,
  addProperty,
  updateProperty,
  deleteProperty,
  addPlannedInvestment,
  updatePlannedInvestment,
  deletePlannedInvestment,
  getHouseholdProfile,
  saveHouseholdProfile,
  getSimulatorProfile,
  saveSimulatorProfile,
  defaultHousehold,
} from './services/portfolioService'

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Loading portfolio…</p>
      </div>
    </div>
  )
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="card max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-900/40 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-white">Failed to connect to Supabase</p>
          <p className="text-slate-400 text-sm mt-1 break-all">{message}</p>
        </div>
        <button onClick={onRetry} className="btn-primary mx-auto">
          Retry
        </button>
      </div>
    </div>
  )
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({ message, type = 'error', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl
                     text-sm font-medium border
                     ${type === 'error'
                       ? 'bg-red-900/90 border-red-700 text-red-100'
                       : 'bg-emerald-900/90 border-emerald-700 text-emerald-100'}`}>
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [properties, setProperties]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [fatalError, setFatalError]     = useState(null)
  const [saving, setSaving]             = useState(false)
  const [toast, setToast]               = useState(null)

  const [activeTab, setActiveTab]               = useState('dashboard')
  const [editingProperty, setEditingProperty]   = useState(null)
  const [showForm, setShowForm]                 = useState(false)
  const [detailProperty, setDetailProperty]     = useState(null)
  const [editingInvestment, setEditingInvestment] = useState(null)
  const [showInvestmentForm, setShowInvestmentForm] = useState(false)

  // ── Phase 8: household profile ──
  const [householdProfile, setHouseholdProfile]     = useState(defaultHousehold())
  const [showHouseholdForm, setShowHouseholdForm]   = useState(false)

  // ── Phase 9: simulator state (lifted so AiChatOverlay can see it) ──
  const [simState, setSimState] = useState(null)

  // ── Auth ──
  const [ownerAuthed, setOwnerAuthed]   = useState(() => isOwner())
  const [showAuthOverlay, setShowAuthOverlay] = useState(false)

  // Pick the right data-layer functions based on auth state
  const db = ownerAuthed
    ? { getPortfolio, addProperty, updateProperty, deleteProperty,
        addPlannedInvestment, updatePlannedInvestment, deletePlannedInvestment,
        getHouseholdProfile, saveHouseholdProfile }
    : { getPortfolio: guestGetPortfolio, addProperty: guestAddProperty,
        updateProperty: guestUpdateProperty, deleteProperty: guestDeleteProperty,
        addPlannedInvestment: guestAddPlannedInvestment,
        updatePlannedInvestment: guestUpdatePlannedInvestment,
        deletePlannedInvestment: guestDeletePlannedInvestment,
        getHouseholdProfile: guestGetHouseholdProfile,
        saveHouseholdProfile: guestSaveHouseholdProfile }

  // ── Load portfolio + household profile (from Supabase or guest localStorage) ──
  const load = useCallback(async () => {
    setLoading(true)
    setFatalError(null)
    try {
      const [portfolio, profile] = await Promise.all([
        db.getPortfolio(),
        db.getHouseholdProfile(),
      ])
      setProperties(portfolio.properties)
      setHouseholdProfile(profile)
    } catch (err) {
      setFatalError(err.message)
    } finally {
      setLoading(false)
    }
  }, [ownerAuthed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // For guests: always fetch a fresh Supabase snapshot on every page load
    // so they see the owner's latest data (including investment positions etc.)
    // For owners: just load from Supabase directly.
    if (!ownerAuthed) {
      Promise.all([getPortfolio(), getHouseholdProfile(), getSimulatorProfile()])
        .then(([portfolio, household, simulator]) => {
          seedGuestStorage(portfolio, household, simulator)
          load()
        })
        .catch(() => load())  // if Supabase unreachable, load empty guest state
    } else {
      load()
    }
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth handlers ──
  const handleLogin = async (password) => {
    const ok = await login(password)
    if (ok) {
      setOwnerAuthed(true)
      // reload from Supabase now that we're owner
      setToast({ message: 'Logged in as owner — data reloaded from Supabase', type: 'success' })
    }
    return ok
  }

  const handleLogout = () => {
    logout()
    setOwnerAuthed(false)
    setShowAuthOverlay(false)
    setToast({ message: 'Switched to guest mode', type: 'success' })
  }

  // ── Reset guest data to owner's Supabase snapshot ──
  const handleReset = async () => {
    try {
      const [portfolio, household, simulator] = await Promise.all([
        getPortfolio(), getHouseholdProfile(), getSimulatorProfile(),
      ])
      seedGuestStorage(portfolio, household, simulator)
      // reload guest view
      const [gPortfolio, gProfile] = await Promise.all([
        guestGetPortfolio(), guestGetHouseholdProfile(),
      ])
      setProperties(gPortfolio.properties)
      setHouseholdProfile(gProfile)
      setToast({ message: 'Data reset to owner\'s snapshot', type: 'success' })
    } catch (err) {
      setToast({ message: `Reset failed: ${err.message}`, type: 'error' })
    }
  }

  // ── Shared save wrapper ──
  const withSave = async (fn, successMsg) => {
    setSaving(true)
    try {
      const portfolio = await fn()
      setProperties(portfolio.properties)
      if (successMsg) setToast({ message: successMsg, type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Handlers ──
  const handleAddProperty = () => {
    setEditingProperty(undefined)
    setShowForm(true)
    setActiveTab('properties')
  }

  const handleEditProperty = (property) => {
    setEditingProperty(property)
    setShowForm(true)
    setDetailProperty(null)
    setActiveTab('properties')
  }

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Delete this property and all its loans?')) return
    await withSave(
      () => db.deleteProperty(null, propertyId),
      'Property deleted'
    )
  }

  const handleSave = async (property) => {
    const isEdit = Boolean(editingProperty)
    await withSave(
      () => isEdit
        ? db.updateProperty(null, property)
        : db.addProperty(null, property),
      isEdit ? 'Property updated' : 'Property added'
    )
    setShowForm(false)
    setEditingProperty(null)
    // Stay on properties tab after saving; if we were editing from detail view, go back there
    setActiveTab('properties')
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingProperty(null)
  }

  // ── Planned investment handlers ──
  const handleAddInvestment = () => {
    setEditingInvestment(undefined)
    setShowInvestmentForm(true)
    setActiveTab('investments')
  }

  const handleEditInvestment = (inv) => {
    setEditingInvestment(inv)
    setShowInvestmentForm(true)
    setActiveTab('investments')
  }

  const handleDeleteInvestment = async (id) => {
    if (!window.confirm('Delete this planned investment?')) return
    await withSave(
      () => db.deletePlannedInvestment(id),
      'Investment deleted'
    )
  }

  const handleSaveInvestment = async (inv) => {
    const isEdit = Boolean(editingInvestment)
    await withSave(
      () => isEdit
        ? db.updatePlannedInvestment(inv)
        : db.addPlannedInvestment(inv),
      isEdit ? 'Investment updated' : 'Investment added'
    )
    setShowInvestmentForm(false)
    setEditingInvestment(null)
  }

  const handleCancelInvestmentForm = () => {
    setShowInvestmentForm(false)
    setEditingInvestment(null)
  }

  // ── Household profile handlers ──
  const handleSaveHousehold = async (profile) => {
    setSaving(true)
    try {
      const saved = await db.saveHouseholdProfile(profile)
      setHouseholdProfile(saved)
      setToast({ message: 'Household profile saved', type: 'success' })
      setShowHouseholdForm(false)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render guards ──
  if (loading) return <LoadingScreen />
  if (fatalError) return <ErrorScreen message={fatalError} onRetry={load} />

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setDetailProperty(null); setShowForm(false) }}
        isOwner={ownerAuthed}
        onOpenAuth={() => setShowAuthOverlay(true)}
        showAuthControls={!isLocalhost()}
      >

        {/* ── Dashboard ── */}
        {activeTab === 'dashboard' && (
          <Dashboard
            properties={properties}
            profile={householdProfile}
            onAddProperty={handleAddProperty}
            onEditProperty={handleEditProperty}
            onDeleteProperty={handleDeleteProperty}
          />
        )}

        {/* ── Property detail view ── */}
        {activeTab === 'properties' && detailProperty && !showForm && (
          <PropertyDetail
            property={properties.find((p) => p.id === detailProperty.id) ?? detailProperty}
            onEdit={() => handleEditProperty(detailProperty)}
            onBack={() => setDetailProperty(null)}
          />
        )}

        {/* ── Properties list ── */}
        {activeTab === 'properties' && !showForm && !detailProperty && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Properties</h1>
                <p className="text-slate-400 text-sm mt-0.5">Manage your real estate portfolio</p>
              </div>
              <button onClick={handleAddProperty} className="btn-primary">
                <PlusIcon />
                Add Property
              </button>
            </div>

            {properties.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <p className="text-slate-300 font-medium">No properties yet</p>
                <p className="text-slate-500 text-sm mt-1 mb-4">
                  Add your first property to start tracking your portfolio
                </p>
                <button onClick={handleAddProperty} className="btn-primary">
                  <PlusIcon />
                  Add Property
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {properties.map((p) => (
                  <PropertyListCard
                    key={p.id}
                    property={p}
                    onView={() => setDetailProperty(p)}
                    onEdit={() => handleEditProperty(p)}
                    onDelete={() => handleDeleteProperty(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Property form ── */}
        {activeTab === 'properties' && showForm && (
          <div className="relative">
            {saving && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <PropertyForm
              property={editingProperty}
              onSave={handleSave}
              onCancel={handleCancelForm}
            />
          </div>
        )}

        {/* ── Investments ── */}
        {activeTab === 'investments' && !showInvestmentForm && (
          <InvestmentsPage
            properties={properties}
            onAdd={handleAddInvestment}
            onEdit={handleEditInvestment}
            onDelete={handleDeleteInvestment}
          />
        )}

        {activeTab === 'investments' && showInvestmentForm && (
          <div className="relative">
            {saving && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <PlannedInvestmentForm
              investment={editingInvestment}
              properties={properties}
              onSave={handleSaveInvestment}
              onCancel={handleCancelInvestmentForm}
            />
          </div>
        )}

        {/* ── Projection ── */}
        {activeTab === 'projection' && (
          <ProjectionChart properties={properties} profile={householdProfile} />
        )}

        {/* ── Scenarios ── */}
        {activeTab === 'scenario' && (
          <ScenarioPlanner properties={properties} />
        )}

        {/* ── Cash-Flow Aggregator ── */}
        {activeTab === 'cashflow' && !showHouseholdForm && (
          <CashFlowAggregator
            properties={properties}
            profile={householdProfile}
            onEditProfile={() => setShowHouseholdForm(true)}
          />
        )}

        {/* ── Household Form ── */}
        {activeTab === 'cashflow' && showHouseholdForm && (
          <div className="relative">
            {saving && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setShowHouseholdForm(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-slate-400 text-sm">Back to Cash-Flow Aggregator</span>
            </div>
            <HouseholdForm
              profile={householdProfile}
              onSave={handleSaveHousehold}
              saving={saving}
            />
          </div>
        )}

        {/* ── Household Profile (standalone nav item) ── */}
        {activeTab === 'household' && (
          <div className="relative">
            {saving && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <HouseholdForm
              profile={householdProfile}
              onSave={handleSaveHousehold}
              saving={saving}
            />
          </div>
        )}

        {/* ── Money Flow ── */}
        {activeTab === 'moneyflow' && (
          <MoneyFlow
            properties={properties}
            profile={householdProfile}
          />
        )}

        {/* ── Property Simulator ── */}
        {activeTab === 'simulator' && (
          <PropertySimulator
            properties={properties}
            onSimChange={setSimState}
            getSimulatorProfile={ownerAuthed ? getSimulatorProfile : guestGetSimulatorProfile}
            saveSimulatorProfile={ownerAuthed ? saveSimulatorProfile : guestSaveSimulatorProfile}
          />
        )}

      </Layout>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* AI Chat overlay — always mounted so it floats above all pages */}
      <AiChatOverlay
        properties={properties}
        profile={householdProfile}
        activeTab={activeTab}
        simState={simState}
        isOwner={ownerAuthed}
      />

      {/* Auth overlay — only on non-localhost deployments */}
      {!isLocalhost() && (
        <AuthOverlay
          open={showAuthOverlay}
          onClose={() => setShowAuthOverlay(false)}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isOwner={ownerAuthed}
          onReset={handleReset}
        />
      )}
    </>
  )
}

// ─── Investments page ─────────────────────────────────────────────────────────

function InvestmentsPage({ properties, onAdd, onEdit, onDelete }) {
  // Flatten all investments with their property name attached
  const allInvestments = properties.flatMap((p) =>
    (p.plannedInvestments || []).map((inv) => ({ ...inv, propertyName: p.name }))
  ).sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate))

  const fmt = (n) =>
    new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const today = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planned Investments</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            One-off capital outlays that increase a property's value from a specific date.
          </p>
        </div>
        <button onClick={onAdd} className="btn-primary" disabled={properties.length === 0}>
          <PlusIcon />
          Add Investment
        </button>
      </div>

      {properties.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-slate-400">Add at least one property before planning investments.</p>
        </div>
      )}

      {properties.length > 0 && allInvestments.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium">No planned investments yet</p>
          <p className="text-slate-500 text-sm mt-1 mb-4">
            Add a renovation, upgrade, or any capital outlay you plan to make.
          </p>
          <button onClick={onAdd} className="btn-primary">
            <PlusIcon />
            Add Investment
          </button>
        </div>
      )}

      {allInvestments.length > 0 && (
        <div className="space-y-3">
          {allInvestments.map((inv) => {
            const date    = new Date(inv.plannedDate)
            const isPast  = date < today
            const yearOffset = Math.round((date - today) / (365.25 * 24 * 60 * 60 * 1000))
            const net     = inv.valueIncrease - inv.cost

            return (
              <div key={inv.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Date badge */}
                <div className={`shrink-0 rounded-xl px-3 py-2 text-center min-w-[72px]
                                  ${isPast ? 'bg-slate-700/50' : 'bg-amber-900/30 border border-amber-700/40'}`}>
                  <p className="text-xs text-slate-400 leading-tight">
                    {date.toLocaleDateString('nl-BE', { month: 'short', year: 'numeric' })}
                  </p>
                  <p className={`text-sm font-bold ${isPast ? 'text-slate-400' : 'text-amber-300'}`}>
                    {isPast ? 'Past' : yearOffset === 0 ? 'This year' : `+${yearOffset}y`}
                  </p>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {inv.description || 'Unnamed investment'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{inv.propertyName}</p>
                </div>

                {/* Financials */}
                <div className="flex gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-xs text-slate-500">Cost</p>
                    <p className="text-sm font-semibold text-red-400">-{fmt(inv.cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Value +</p>
                    <p className="text-sm font-semibold text-emerald-400">+{fmt(inv.valueIncrease)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Net</p>
                    <p className={`text-sm font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {net >= 0 ? '+' : ''}{fmt(net)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onEdit(inv)}
                    className="text-slate-400 hover:text-brand-400 transition-colors">
                    <EditIcon />
                  </button>
                  <button onClick={() => onDelete(inv.id)}
                    className="text-slate-400 hover:text-red-400 transition-colors">
                    <TrashIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Property list card ───────────────────────────────────────────────────────

function PropertyListCard({ property, onView, onEdit, onDelete }) {
  const fmt = (n) =>
    new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const STATUS_COLORS = {
    owner_occupied: 'bg-brand-800/50 text-brand-300 border-brand-700/50',
    rented:         'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    vacant:         'bg-slate-700/60 text-slate-300 border-slate-600/60',
    for_sale:       'bg-amber-900/40 text-amber-300 border-amber-700/40',
    renovation:     'bg-orange-900/40 text-orange-300 border-orange-700/40',
  }
  const STATUS_LABELS = {
    owner_occupied: 'Owner-occupied',
    rented:         'Rented out',
    vacant:         'Vacant',
    for_sale:       'For sale',
    renovation:     'Renovation',
  }
  const sc = STATUS_COLORS[property.status] ?? STATUS_COLORS.owner_occupied
  const sl = STATUS_LABELS[property.status] ?? property.status

  return (
    <div
      className="card space-y-3 cursor-pointer hover:border-brand-500/50 hover:bg-slate-800/80 transition-all group"
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onView()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
              {property.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${sc}`}>
              {sl}
            </span>
          </div>
          {property.address && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{property.address}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="text-slate-400 hover:text-brand-400 transition-colors"
            title="Edit"
          >
            <EditIcon />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-slate-400">Value </span>
          <span className="text-white font-medium">{fmt(property.currentValue)}</span>
        </div>
        <div>
          <span className="text-slate-400">Loans </span>
          <span className="text-white font-medium">{property.loans?.length || 0}</span>
        </div>
        <div>
          <span className="text-slate-400">Appreciation </span>
          <span className="text-white font-medium">
            {((property.appreciationRate || 0.02) * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-slate-400">Renovations </span>
          <span className="text-white font-medium">{property.plannedInvestments?.length || 0}</span>
        </div>
      </div>
      <p className="text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to view full property details →
      </p>
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
