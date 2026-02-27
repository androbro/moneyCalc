import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import CSVImporter from './CSVImporter'

const EMPTY_LOAN = () => ({
  id: uuidv4(),
  lender: '',
  originalAmount: '',
  interestRate: '',
  startDate: '',
  termMonths: '',
  monthlyPayment: '',
  amortizationSchedule: [],
})

const EMPTY_PROPERTY = () => ({
  id: uuidv4(),
  name: '',
  address: '',
  purchasePrice: '',
  currentValue: '',
  appreciationRate: '0.02',
  monthlyRentalIncome: '',
  monthlyExpenses: '',
  purchaseDate: '',
  loans: [],
})

function Field({ label, children, required }) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function LoanForm({ loan, index, onChange, onRemove, onScheduleImport }) {
  const [showImporter, setShowImporter] = useState(false)

  const handleField = (field, value) => {
    onChange(index, { ...loan, [field]: value })
  }

  const handleSchedule = (schedule) => {
    onScheduleImport(index, schedule)
    setShowImporter(false)
  }

  return (
    <div className="border border-slate-600 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-200">Loan {index + 1}</h4>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-300 text-sm transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Lender" required>
          <input
            className="input"
            placeholder="e.g. KBC"
            value={loan.lender}
            onChange={(e) => handleField('lender', e.target.value)}
          />
        </Field>

        <Field label="Original Amount (EUR)" required>
          <input
            className="input"
            type="number"
            min="0"
            placeholder="230000"
            value={loan.originalAmount}
            onChange={(e) => handleField('originalAmount', e.target.value)}
          />
        </Field>

        <Field label="Annual Interest Rate" required>
          <div className="relative">
            <input
              className="input pr-8"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="1.95"
              value={loan.interestRate !== '' ? (Number(loan.interestRate) * 100).toFixed(2) : ''}
              onChange={(e) =>
                handleField('interestRate', e.target.value !== '' ? Number(e.target.value) / 100 : '')
              }
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </Field>

        <Field label="Monthly Payment (EUR)">
          <input
            className="input"
            type="number"
            min="0"
            placeholder="1156.23"
            value={loan.monthlyPayment}
            onChange={(e) => handleField('monthlyPayment', e.target.value)}
          />
        </Field>

        <Field label="Start Date" required>
          <input
            className="input"
            type="date"
            value={loan.startDate}
            onChange={(e) => handleField('startDate', e.target.value)}
          />
        </Field>

        <Field label="Term (months)" required>
          <input
            className="input"
            type="number"
            min="1"
            placeholder="240"
            value={loan.termMonths}
            onChange={(e) => handleField('termMonths', e.target.value)}
          />
        </Field>
      </div>

      {/* Amortization schedule */}
      <div>
        {loan.amortizationSchedule?.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-emerald-900/30 border border-emerald-700 rounded-lg px-3 py-2 text-sm text-emerald-300">
              Schedule loaded: {loan.amortizationSchedule.length} rows
            </div>
            <button
              type="button"
              onClick={() => setShowImporter(!showImporter)}
              className="btn-secondary text-sm py-1.5"
            >
              Replace CSV
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowImporter(!showImporter)}
            className="btn-secondary text-sm"
          >
            <UploadIcon />
            Import Amortization CSV
          </button>
        )}

        {showImporter && (
          <div className="mt-3">
            <CSVImporter onImport={handleSchedule} />
          </div>
        )}
      </div>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}

export default function PropertyForm({ property: editProperty, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY_PROPERTY)
  const [loans, setLoans] = useState([])

  useEffect(() => {
    if (editProperty) {
      setForm({
        ...editProperty,
        appreciationRate: String(editProperty.appreciationRate ?? 0.02),
        purchasePrice: String(editProperty.purchasePrice ?? ''),
        currentValue: String(editProperty.currentValue ?? ''),
        monthlyRentalIncome: String(editProperty.monthlyRentalIncome ?? ''),
        monthlyExpenses: String(editProperty.monthlyExpenses ?? ''),
      })
      setLoans(
        (editProperty.loans || []).map((l) => ({
          ...l,
          originalAmount: String(l.originalAmount ?? ''),
          termMonths: String(l.termMonths ?? ''),
          monthlyPayment: String(l.monthlyPayment ?? ''),
        }))
      )
    }
  }, [editProperty])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const addLoan = () => setLoans((prev) => [...prev, EMPTY_LOAN()])

  const updateLoan = (index, updated) =>
    setLoans((prev) => prev.map((l, i) => (i === index ? updated : l)))

  const removeLoan = (index) =>
    setLoans((prev) => prev.filter((_, i) => i !== index))

  const importSchedule = (index, schedule) =>
    setLoans((prev) =>
      prev.map((l, i) => (i === index ? { ...l, amortizationSchedule: schedule } : l))
    )

  const handleSubmit = (e) => {
    e.preventDefault()
    const property = {
      ...form,
      purchasePrice: Number(form.purchasePrice) || 0,
      currentValue: Number(form.currentValue) || 0,
      appreciationRate: Number(form.appreciationRate) || 0.02,
      monthlyRentalIncome: Number(form.monthlyRentalIncome) || 0,
      monthlyExpenses: Number(form.monthlyExpenses) || 0,
      loans: loans.map((l) => ({
        ...l,
        propertyId: form.id,
        originalAmount: Number(l.originalAmount) || 0,
        termMonths: Number(l.termMonths) || 0,
        monthlyPayment: Number(l.monthlyPayment) || 0,
        interestRate: Number(l.interestRate) || 0,
      })),
    }
    onSave(property)
  }

  const isEdit = Boolean(editProperty)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {isEdit ? 'Edit Property' : 'Add Property'}
        </h2>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-100">
          <CloseIcon />
        </button>
      </div>

      {/* Property details */}
      <div className="card space-y-4">
        <h3 className="section-title mb-2">Property Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Property Name" required>
              <input
                className="input"
                placeholder="e.g. Apartment Brussels"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Address">
              <input
                className="input"
                placeholder="e.g. Rue de la Loi 1, 1000 Brussels"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Purchase Price (EUR)">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="275000"
              value={form.purchasePrice}
              onChange={(e) => setField('purchasePrice', e.target.value)}
            />
          </Field>

          <Field label="Current Market Value (EUR)" required>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="285000"
              value={form.currentValue}
              onChange={(e) => setField('currentValue', e.target.value)}
              required
            />
          </Field>

          <Field label="Annual Appreciation Rate">
            <div className="relative">
              <input
                className="input pr-8"
                type="number"
                step="0.1"
                min="0"
                max="20"
                placeholder="2.0"
                value={Number(form.appreciationRate) * 100 || ''}
                onChange={(e) =>
                  setField('appreciationRate', String(Number(e.target.value) / 100))
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
          </Field>

          <Field label="Purchase Date">
            <input
              className="input"
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setField('purchaseDate', e.target.value)}
            />
          </Field>

          <Field label="Monthly Rental Income (EUR)">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="1200"
              value={form.monthlyRentalIncome}
              onChange={(e) => setField('monthlyRentalIncome', e.target.value)}
            />
          </Field>

          <Field label="Monthly Expenses (EUR)">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="150"
              value={form.monthlyExpenses}
              onChange={(e) => setField('monthlyExpenses', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Loans */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title mb-0">Loans</h3>
          <button
            type="button"
            onClick={addLoan}
            className="btn-secondary text-sm py-1.5"
          >
            <PlusIcon />
            Add Loan
          </button>
        </div>

        {loans.length === 0 && (
          <p className="text-slate-500 text-sm">No loans linked yet.</p>
        )}

        {loans.map((loan, i) => (
          <LoanForm
            key={loan.id}
            loan={loan}
            index={i}
            onChange={updateLoan}
            onRemove={removeLoan}
            onScheduleImport={importSchedule}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {isEdit ? 'Save Changes' : 'Add Property'}
        </button>
      </div>
    </form>
  )
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
