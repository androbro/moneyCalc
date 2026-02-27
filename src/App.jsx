import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ProjectionChart from './components/ProjectionChart'
import PropertyForm from './components/PropertyForm'
import ScenarioPlanner from './components/ScenarioPlanner'
import {
  getPortfolio,
  addProperty,
  updateProperty,
  deleteProperty,
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

  const [activeTab, setActiveTab]           = useState('dashboard')
  const [editingProperty, setEditingProperty] = useState(null)
  const [showForm, setShowForm]             = useState(false)

  // ── Load portfolio from Supabase ──
  const load = useCallback(async () => {
    setLoading(true)
    setFatalError(null)
    try {
      const portfolio = await getPortfolio()
      setProperties(portfolio.properties)
    } catch (err) {
      setFatalError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
    setActiveTab('properties')
  }

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Delete this property and all its loans?')) return
    await withSave(
      () => deleteProperty(null, propertyId),
      'Property deleted'
    )
  }

  const handleSave = async (property) => {
    const isEdit = Boolean(editingProperty)
    await withSave(
      () => isEdit
        ? updateProperty(null, property)
        : addProperty(null, property),
      isEdit ? 'Property updated' : 'Property added'
    )
    setShowForm(false)
    setEditingProperty(null)
    setActiveTab('dashboard')
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingProperty(null)
  }

  // ── Render guards ──
  if (loading) return <LoadingScreen />
  if (fatalError) return <ErrorScreen message={fatalError} onRetry={load} />

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>

        {/* ── Dashboard ── */}
        {activeTab === 'dashboard' && (
          <Dashboard
            properties={properties}
            onAddProperty={handleAddProperty}
            onEditProperty={handleEditProperty}
            onDeleteProperty={handleDeleteProperty}
          />
        )}

        {/* ── Properties list ── */}
        {activeTab === 'properties' && !showForm && (
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

        {/* ── Projection ── */}
        {activeTab === 'projection' && (
          <ProjectionChart properties={properties} />
        )}

        {/* ── Scenarios ── */}
        {activeTab === 'scenario' && (
          <ScenarioPlanner properties={properties} />
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
    </>
  )
}

// ─── Property list card ───────────────────────────────────────────────────────

function PropertyListCard({ property, onEdit, onDelete }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{property.name}</h3>
          <p className="text-xs text-slate-400 truncate">{property.address}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="text-slate-400 hover:text-brand-400 transition-colors">
            <EditIcon />
          </button>
          <button onClick={onDelete} className="text-slate-400 hover:text-red-400 transition-colors">
            <TrashIcon />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-slate-400">Value </span>
          <span className="text-white font-medium">
            {new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
              .format(property.currentValue)}
          </span>
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
          <span className="text-slate-400">Schedules </span>
          <span className="text-white font-medium">
            {property.loans?.filter((l) => l.amortizationSchedule?.length > 0).length || 0}
          </span>
        </div>
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
