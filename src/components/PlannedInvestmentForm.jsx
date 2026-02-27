import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const EMPTY = () => ({
  id:            uuidv4(),
  propertyId:    '',
  description:   '',
  plannedDate:   '',
  cost:          '',
  valueIncrease: '',
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children, required }) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Form to add or edit a planned investment.
 *
 * Props:
 *   investment  – existing investment object when editing; undefined when creating
 *   properties  – full property list so the user can pick which property
 *   onSave(inv) – called with the validated investment object
 *   onCancel()  – called when the user dismisses without saving
 */
export default function PlannedInvestmentForm({ investment: editInvestment, properties, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (editInvestment) {
      setForm({
        ...EMPTY(),
        ...editInvestment,
        cost:          String(editInvestment.cost ?? ''),
        valueIncrease: String(editInvestment.valueIncrease ?? ''),
      })
    }
  }, [editInvestment])

  const si = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...form,
      cost:          Number(form.cost) || 0,
      valueIncrease: Number(form.valueIncrease) || 0,
    })
  }

  const isEdit = Boolean(editInvestment)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {isEdit ? 'Edit Planned Investment' : 'Add Planned Investment'}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            A one-off spend that increases a property's value from a specific date.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-100">
          <CloseIcon />
        </button>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Property picker */}
          <Field label="Property" required>
            <select
              className="input"
              required
              value={form.propertyId}
              onChange={si('propertyId')}
            >
              <option value="">Select a property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {/* Planned date */}
          <Field label="Planned Date" required hint="When you expect to make this investment">
            <input
              className="input"
              type="date"
              required
              value={form.plannedDate}
              onChange={si('plannedDate')}
            />
          </Field>

          {/* Description — spans full width */}
          <div className="sm:col-span-2">
            <Field label="Description" hint="e.g. Kitchen renovation, new roof, EV charger">
              <input
                className="input"
                placeholder="e.g. Kitchen renovation"
                value={form.description}
                onChange={si('description')}
              />
            </Field>
          </div>

          {/* Cost */}
          <Field
            label="Investment Cost (EUR)"
            required
            hint="Total cash you will spend — subtracted from cash flow in that year"
          >
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="15000"
              required
              value={form.cost}
              onChange={si('cost')}
            />
          </Field>

          {/* Value increase */}
          <Field
            label="Expected Value Increase (EUR)"
            required
            hint="How much the property's market value rises immediately after this investment"
          >
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="20000"
              required
              value={form.valueIncrease}
              onChange={si('valueIncrease')}
            />
          </Field>

        </div>

        {/* Quick summary */}
        {form.cost && form.valueIncrease && (
          <div className="bg-slate-800/60 rounded-xl p-3 text-sm text-slate-300 mt-2">
            <span className="text-slate-400">Net value impact: </span>
            <span className={
              Number(form.valueIncrease) - Number(form.cost) >= 0
                ? 'text-emerald-400 font-semibold'
                : 'text-red-400 font-semibold'
            }>
              {Number(form.valueIncrease) - Number(form.cost) >= 0 ? '+' : ''}
              {new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                .format(Number(form.valueIncrease) - Number(form.cost))}
            </span>
            <span className="text-slate-500 ml-2">(value increase minus cost)</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">
          {isEdit ? 'Save Changes' : 'Add Investment'}
        </button>
      </div>
    </form>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
