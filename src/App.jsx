import { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ProjectionChart from './components/ProjectionChart'
import PropertyForm from './components/PropertyForm'
import ScenarioPlanner from './components/ScenarioPlanner'
import { useLocalStorage } from './hooks/useLocalStorage'
import { addProperty, updateProperty, deleteProperty } from './services/portfolioService'

const EMPTY_PORTFOLIO = {
  properties: [],
  meta: {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    currency: 'EUR',
  },
}

export default function App() {
  const [portfolio, setPortfolio] = useLocalStorage('moneyCalc_portfolio', EMPTY_PORTFOLIO)
  const [activeTab, setActiveTab] = useState('dashboard')
  // null = not editing, undefined = new property, object = editing existing
  const [editingProperty, setEditingProperty] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const properties = portfolio.properties || []

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

  const handleDeleteProperty = (propertyId) => {
    if (!window.confirm('Delete this property and all its loans?')) return
    setPortfolio(deleteProperty(portfolio, propertyId))
  }

  const handleSave = (property) => {
    if (editingProperty) {
      setPortfolio(updateProperty(portfolio, property))
    } else {
      setPortfolio(addProperty(portfolio, property))
    }
    setShowForm(false)
    setEditingProperty(null)
    setActiveTab('dashboard')
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingProperty(null)
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Properties tab: show form OR list depending on state */}
      {activeTab === 'properties' && showForm && (
        <PropertyForm
          property={editingProperty}
          onSave={handleSave}
          onCancel={handleCancelForm}
        />
      )}

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

      {activeTab === 'dashboard' && (
        <Dashboard
          properties={properties}
          onAddProperty={handleAddProperty}
          onEditProperty={handleEditProperty}
          onDeleteProperty={handleDeleteProperty}
        />
      )}

      {activeTab === 'projection' && (
        <ProjectionChart properties={properties} />
      )}

      {activeTab === 'scenario' && (
        <ScenarioPlanner properties={properties} />
      )}
    </Layout>
  )
}

// Compact card for the Properties list view
function PropertyListCard({ property, onEdit, onDelete }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{property.name}</h3>
          <p className="text-xs text-slate-400 truncate">{property.address}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="text-slate-400 hover:text-brand-400 transition-colors"
          >
            <EditIcon />
          </button>
          <button
            onClick={onDelete}
            className="text-slate-400 hover:text-red-400 transition-colors"
          >
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
