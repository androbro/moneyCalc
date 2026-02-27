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
  purchaseDate: '',
  // Cash flow
  startRentalIncome: '',
  indexationRate: '0.02',
  monthlyExpenses: '',
  // Operating costs (new Phase 5)
  annualMaintenanceCost: '',
  annualInsuranceCost: '',
  annualPropertyTax: '',
  inflationRate: '0.02',
  loans: [],
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children, required, span2 = false }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="label">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function PctInput({ value, onChange, placeholder = '2.0', step = '0.1', min = '0', max = '100' }) {
  return (
    <div className="relative">
      <input
        className="input pr-8"
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value !== '' ? (Number(value) * 100).toFixed(step === '0.01' ? 2 : 1) : ''}
        onChange={(e) =>
          onChange(e.target.value !== '' ? String(Number(e.target.value) / 100) : '')
        }
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
    </div>
  )
}

// ─── Loan sub-form ────────────────────────────────────────────────────────────

function LoanForm({ loan, index, onChange, onRemove, onScheduleImport }) {
  const [showImporter, setShowImporter] = useState(false)
  const set = (field, value) => onChange(index, { ...loan, [field]: value })

  const handleSchedule = (schedule) => {
    onScheduleImport(index, schedule)
    setShowImporter(false)
  }

  return (
    <div className="border border-slate-600 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-200">Loan {index + 1}</h4>
        <button type="button" onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-300 text-sm transition-colors">
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Lender" required>
          <input className="input" placeholder="e.g. KBC" value={loan.lender}
            onChange={(e) => set('lender', e.target.value)} />
        </Field>

        <Field label="Original Amount (EUR)" required>
          <input className="input" type="number" min="0" placeholder="230000"
            value={loan.originalAmount} onChange={(e) => set('originalAmount', e.target.value)} />
        </Field>

        <Field label="Annual Interest Rate" required>
          <PctInput step="0.01" placeholder="1.95"
            value={loan.interestRate}
            onChange={(v) => set('interestRate', v)} />
        </Field>

        <Field label="Monthly Payment (EUR)">
          <input className="input" type="number" min="0" placeholder="1156.23"
            value={loan.monthlyPayment} onChange={(e) => set('monthlyPayment', e.target.value)} />
        </Field>

        <Field label="Start Date" required>
          <input className="input" type="date" value={loan.startDate}
            onChange={(e) => set('startDate', e.target.value)} />
        </Field>

        <Field label="Term (months)" required>
          <input className="input" type="number" min="1" placeholder="240"
            value={loan.termMonths} onChange={(e) => set('termMonths', e.target.value)} />
        </Field>
      </div>

      {/* Amortization schedule */}
      <div>
        {loan.amortizationSchedule?.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-emerald-900/30 border border-emerald-700 rounded-lg px-3 py-2 text-sm text-emerald-300">
              Schedule loaded: {loan.amortizationSchedule.length} rows
            </div>
            <button type="button" onClick={() => setShowImporter(!showImporter)}
              className="btn-secondary text-sm py-1.5">
              Replace CSV
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowImporter(!showImporter)}
            className="btn-secondary text-sm">
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

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="card space-y-4">
      <h3 className="section-title mb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function PropertyForm({ property: editProperty, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY_PROPERTY)
  const [loans, setLoans] = useState([])

  useEffect(() => {
    if (editProperty) {
      setForm({
        ...EMPTY_PROPERTY(),
        ...editProperty,
        purchasePrice:         String(editProperty.purchasePrice ?? ''),
        currentValue:          String(editProperty.currentValue ?? ''),
        appreciationRate:      String(editProperty.appreciationRate ?? 0.02),
        startRentalIncome:     String(editProperty.startRentalIncome ?? editProperty.monthlyRentalIncome ?? ''),
        indexationRate:        String(editProperty.indexationRate ?? 0.02),
        monthlyExpenses:       String(editProperty.monthlyExpenses ?? ''),
        annualMaintenanceCost: String(editProperty.annualMaintenanceCost ?? ''),
        annualInsuranceCost:   String(editProperty.annualInsuranceCost ?? ''),
        annualPropertyTax:     String(editProperty.annualPropertyTax ?? ''),
        inflationRate:         String(editProperty.inflationRate ?? 0.02),
      })
      setLoans(
        (editProperty.loans || []).map((l) => ({
          ...l,
          originalAmount: String(l.originalAmount ?? ''),
          termMonths:     String(l.termMonths ?? ''),
          monthlyPayment: String(l.monthlyPayment ?? ''),
        }))
      )
    }
  }, [editProperty])

  const sf = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))
  const si = (field) => (e)     => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const addLoan        = () => setLoans((prev) => [...prev, EMPTY_LOAN()])
  const updateLoan     = (i, u) => setLoans((prev) => prev.map((l, idx) => idx === i ? u : l))
  const removeLoan     = (i)    => setLoans((prev) => prev.filter((_, idx) => idx !== i))
  const importSchedule = (i, s) => setLoans((prev) =>
    prev.map((l, idx) => idx === i ? { ...l, amortizationSchedule: s } : l)
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const property = {
      ...form,
      purchasePrice:         Number(form.purchasePrice) || 0,
      currentValue:          Number(form.currentValue) || 0,
      appreciationRate:      Number(form.appreciationRate) || 0.02,
      startRentalIncome:     Number(form.startRentalIncome) || 0,
      monthlyRentalIncome:   Number(form.startRentalIncome) || 0, // legacy sync
      indexationRate:        Number(form.indexationRate) || 0.02,
      monthlyExpenses:       Number(form.monthlyExpenses) || 0,
      annualMaintenanceCost: Number(form.annualMaintenanceCost) || 0,
      annualInsuranceCost:   Number(form.annualInsuranceCost) || 0,
      annualPropertyTax:     Number(form.annualPropertyTax) || 0,
      inflationRate:         Number(form.inflationRate) || 0.02,
      loans: loans.map((l) => ({
        ...l,
        propertyId:     form.id,
        originalAmount: Number(l.originalAmount) || 0,
        termMonths:     Number(l.termMonths) || 0,
        monthlyPayment: Number(l.monthlyPayment) || 0,
        interestRate:   Number(l.interestRate) || 0,
      })),
    }
    onSave(property)
  }

  const isEdit = Boolean(editProperty)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {isEdit ? 'Edit Property' : 'Add Property'}
        </h2>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-100">
          <CloseIcon />
        </button>
      </div>

      {/* ── Section 1: Property Details ── */}
      <Section title="Property Details">
        <Field label="Property Name" required span2>
          <input className="input" placeholder="e.g. Apartment Brussels"
            value={form.name} onChange={si('name')} required />
        </Field>

        <Field label="Address" span2>
          <input className="input" placeholder="e.g. Rue de la Loi 1, 1000 Brussels"
            value={form.address} onChange={si('address')} />
        </Field>

        <Field label="Purchase Price (EUR)">
          <input className="input" type="number" min="0" placeholder="275000"
            value={form.purchasePrice} onChange={si('purchasePrice')} />
        </Field>

        <Field label="Current Market Value (EUR)" required>
          <input className="input" type="number" min="0" placeholder="285000"
            value={form.currentValue} onChange={si('currentValue')} required />
        </Field>

        <Field label="Annual Appreciation Rate"
          hint="Expected property value increase per year">
          <PctInput value={form.appreciationRate} onChange={sf('appreciationRate')} />
        </Field>

        <Field label="Purchase Date">
          <input className="input" type="date" value={form.purchaseDate} onChange={si('purchaseDate')} />
        </Field>
      </Section>

      {/* ── Section 2: Rental Income & Indexation ── */}
      <Section title="Rental Income & Indexation">
        <Field label="Monthly Rental Income (EUR)"
          hint="Current gross rent — starting point for annual indexation">
          <input className="input" type="number" min="0" placeholder="1200"
            value={form.startRentalIncome} onChange={si('startRentalIncome')} />
        </Field>

        <Field label="Annual Rent Indexation Rate"
          hint="How much rent rises each year (e.g. 2% ≈ CPI)">
          <PctInput value={form.indexationRate} onChange={sf('indexationRate')} />
        </Field>
      </Section>

      {/* ── Section 3: Operating Expenses ── */}
      <Section title="Operating Expenses">
        <Field label="Annual Maintenance Cost (EUR)"
          hint="Repairs, upkeep — inflated each year">
          <input className="input" type="number" min="0" placeholder="600"
            value={form.annualMaintenanceCost} onChange={si('annualMaintenanceCost')} />
        </Field>

        <Field label="Annual Insurance Cost (EUR)"
          hint="Fire, liability — inflated each year">
          <input className="input" type="number" min="0" placeholder="400"
            value={form.annualInsuranceCost} onChange={si('annualInsuranceCost')} />
        </Field>

        <Field label="Annual Property Tax (EUR)"
          hint="Onroerende voorheffing — fixed amount, never indexed">
          <input className="input" type="number" min="0" placeholder="800"
            value={form.annualPropertyTax} onChange={si('annualPropertyTax')} />
        </Field>

        <Field label="Other Monthly Expenses (EUR)"
          hint="Syndic, misc — inflated annually">
          <input className="input" type="number" min="0" placeholder="150"
            value={form.monthlyExpenses} onChange={si('monthlyExpenses')} />
        </Field>

        <Field label="Cost Inflation Rate"
          hint="Annual increase applied to maintenance, insurance &amp; other costs (not property tax)">
          <PctInput value={form.inflationRate} onChange={sf('inflationRate')} />
        </Field>
      </Section>

      {/* ── Section 4: Loans ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title mb-0">Loans</h3>
          <button type="button" onClick={addLoan} className="btn-secondary text-sm py-1.5">
            <PlusIcon />
            Add Loan
          </button>
        </div>

        {loans.length === 0 && (
          <p className="text-slate-500 text-sm">No loans linked yet.</p>
        )}

        {loans.map((loan, i) => (
          <LoanForm key={loan.id} loan={loan} index={i}
            onChange={updateLoan} onRemove={removeLoan} onScheduleImport={importSchedule} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">
          {isEdit ? 'Save Changes' : 'Add Property'}
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

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
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
