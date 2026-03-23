import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import CSVImporter from '../CSVImporter'
import PropertyTimeline from '../PropertyTimeline'

// ─── Property status options ───────────────────────────────────────────────────

export const PROPERTY_STATUSES = [
  { value: 'owner_occupied', label: 'Owner-occupied',    color: 'text-sky-800',   bg: 'bg-sky-100 border-sky-200/80 shadow-neo-inset-sm' },
  { value: 'rented',         label: 'Rented out',        color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-200/80 shadow-neo-inset-sm' },
  { value: 'vacant',         label: 'Vacant',            color: 'text-amber-900',   bg: 'bg-amber-50 border-amber-200/80 shadow-neo-inset-sm' },
  { value: 'for_sale',       label: 'For sale',          color: 'text-orange-900',  bg: 'bg-orange-100 border-orange-200/80 shadow-neo-inset-sm' },
  { value: 'renovation',     label: 'Under renovation',  color: 'text-purple-900',  bg: 'bg-purple-100 border-purple-200/80 shadow-neo-inset-sm' },
  { value: 'planned',        label: 'Planned / Simulated', color: 'text-sky-900',   bg: 'bg-sky-50 border-sky-200/80 shadow-neo-inset-sm' },
]

export function getStatusMeta(status) {
  return PROPERTY_STATUSES.find((s) => s.value === status) ?? PROPERTY_STATUSES[1]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if rental income is active on `date` (default: today).
 * Rules:
 *  - status must be 'rented'
 *  - if rentalStartDate set, date must be >= it
 *  - if rentalEndDate set, date must be <= it
 */
export function isRentalActive(property, date = new Date()) {
  if (property.status !== 'rented') return false
  if (property.rentalStartDate) {
    if (new Date(property.rentalStartDate) > date) return false
  }
  if (property.rentalEndDate) {
    if (new Date(property.rentalEndDate) < date) return false
  }
  return true
}

/**
 * Returns true if this property is the primary residence on `date`.
 */
export function isPrimaryResidenceOn(property, date = new Date()) {
  if (!property.isPrimaryResidence) return false
  if (property.residenceStartDate && new Date(property.residenceStartDate) > date) return false
  if (property.residenceEndDate   && new Date(property.residenceEndDate)   < date) return false
  return true
}

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
  valuationDate: '',
  appreciationRate: '0.02',
  purchaseDate: '',
  // Acquisition costs — empty string = "not entered, use estimate"
  registrationTax: '',
  notaryFees: '',
  agencyFees: '',
  otherAcquisitionCosts: '',
  // Ownership
  owners: [{ name: 'Me', share: 1 }],
  // Status & lifecycle
  status: 'owner_occupied',
  rentalStartDate: '',
  rentalEndDate: '',
  isPrimaryResidence: false,
  residenceStartDate: '',
  residenceEndDate: '',
  // Legacy (kept for back-compat)
  isRented: false,
  // Rental intent flag (independent of current status)
  intendedRental: false,
  // Income
  startRentalIncome: '',
  indexationRate: '0.02',
  vacancyRate: '0.05',
  // Costs
  monthlyExpenses: '',
  annualMaintenanceCost: '',
  annualInsuranceCost: '',
  annualPropertyTax: '',
  inflationRate: '0.02',
  loans: [],
})

// ─── Shared sub-components ────────────────────────────────────────────────────

function Field({ label, hint, children, required, span2 = false }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="label">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-neo-subtle mt-1">{hint}</p>}
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
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neo-muted text-sm">%</span>
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
                    transition-colors duration-200 focus:outline-none
                    ${checked ? 'bg-brand-600' : 'bg-neo-sunken'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                      transform transition-transform duration-200
                      ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
      <span className="text-sm text-neo-muted">{label}</span>
    </label>
  )
}

// ─── Loan sub-form ─────────────────────────────────────────────────────────────

function LoanForm({ loan, index, onChange, onRemove, onScheduleImport }) {
  const [showImporter, setShowImporter] = useState(false)
  const set = (field, value) => onChange(index, { ...loan, [field]: value })

  const handleSchedule = (schedule) => {
    onScheduleImport(index, schedule)
    setShowImporter(false)
  }

  return (
    <div className="border border-neo-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-neo-text/95">Loan {index + 1}</h4>
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
            <div className="flex-1 bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2 text-sm text-emerald-900 shadow-neo-inset-sm">
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

// ─── Status selector ──────────────────────────────────────────────────────────

function StatusSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {PROPERTY_STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-left transition-all
            ${value === s.value
              ? `${s.bg} ${s.color} border-current shadow-sm`
              : 'bg-neo-raised border-neo-border text-neo-muted hover:border-neo-border hover:text-neo-text/95'
            }`}
        >
          <span className={`block text-base mb-0.5 ${value === s.value ? s.color : 'text-neo-subtle'}`}>
            {STATUS_ICONS[s.value]}
          </span>
          {s.label}
        </button>
      ))}
    </div>
  )
}

const STATUS_ICONS = {
  owner_occupied: '🏠',
  rented:         '🔑',
  vacant:         '⬜',
  for_sale:       '🏷️',
  renovation:     '🔨',
  planned:        '💡',
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function PropertyForm({ property: editProperty, profile, onSave, onCancel }) {
  // Names available to pick from: household members + a fallback "Other"
  const memberNames = (profile?.members || []).map((m) => m.name).filter(Boolean)
  const [form, setForm] = useState(EMPTY_PROPERTY)
  const [loans, setLoans] = useState([])

  useEffect(() => {
    if (editProperty) {
      const existingRegTaxRate = editProperty.registrationTax != null ? Number(editProperty.registrationTax) : null
      setForm({
        ...EMPTY_PROPERTY(),
        ...editProperty,
        owners: (editProperty.owners?.length ? editProperty.owners : [{ name: 'Me', share: 1 }])
          .map((o) => ({
            ...o,
            // migrate: if no per-owner rate, seed from property-level rate
            registrationTaxRate: o.registrationTaxRate != null
              ? o.registrationTaxRate
              : existingRegTaxRate,
          })),
        status:                editProperty.status ?? (editProperty.isRented ? 'rented' : 'owner_occupied'),
        intendedRental:        editProperty.intendedRental ?? editProperty.isRented ?? (editProperty.status === 'rented'),
        rentalStartDate:       editProperty.rentalStartDate ?? '',
        rentalEndDate:         editProperty.rentalEndDate ?? '',
        isPrimaryResidence:    editProperty.isPrimaryResidence ?? false,
        residenceStartDate:    editProperty.residenceStartDate ?? '',
        residenceEndDate:      editProperty.residenceEndDate ?? '',
        purchasePrice:         String(editProperty.purchasePrice ?? ''),
        currentValue:          String(editProperty.currentValue ?? ''),
        appreciationRate:      String(editProperty.appreciationRate ?? 0.02),
        // null → '' so inputs stay uncontrolled-safe
        registrationTax:       editProperty.registrationTax   != null ? String(editProperty.registrationTax)   : '',
        notaryFees:            editProperty.notaryFees         != null ? String(editProperty.notaryFees)         : '',
        agencyFees:            editProperty.agencyFees         != null ? String(editProperty.agencyFees)         : '',
        otherAcquisitionCosts: editProperty.otherAcquisitionCosts != null ? String(editProperty.otherAcquisitionCosts) : '',
        startRentalIncome:     String(editProperty.startRentalIncome ?? editProperty.monthlyRentalIncome ?? ''),
        indexationRate:        String(editProperty.indexationRate ?? 0.02),
        vacancyRate:           String(editProperty.vacancyRate ?? 0.05),
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

  const sf  = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))
  const si  = (field) => (e)     => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const sib = (field) => (v)     => setForm((prev) => ({ ...prev, [field]: v }))

  // Planned / simulated toggle — flips status to 'planned' and back
  const isPlanned = form.status === 'planned'
  const togglePlanned = () => {
    if (isPlanned) {
      setForm((prev) => ({ ...prev, status: prev._prePlannedStatus ?? 'owner_occupied' }))
    } else {
      setForm((prev) => ({ ...prev, status: 'planned', _prePlannedStatus: prev.status }))
    }
  }

  // Rental intent — true if status is 'rented' OR explicitly flagged
  const isIntendedRental = form.status === 'rented' || Boolean(form.intendedRental)
  const toggleIntendedRental = () => {
    if (isIntendedRental) {
      setForm((prev) => ({
        ...prev,
        intendedRental: false,
        // If currently rented, switch to owner_occupied (or planned if that's active)
        status: prev.status === 'rented' ? (prev._prePlannedStatus === 'planned' || prev.status === 'planned' ? 'planned' : 'owner_occupied') : prev.status,
      }))
    } else {
      setForm((prev) => ({ ...prev, intendedRental: true }))
    }
  }

  const addLoan        = () => setLoans((prev) => [...prev, EMPTY_LOAN()])
  const updateLoan     = (i, u) => setLoans((prev) => prev.map((l, idx) => idx === i ? u : l))
  const removeLoan     = (i)    => setLoans((prev) => prev.filter((_, idx) => idx !== i))
  const importSchedule = (i, s) => setLoans((prev) =>
    prev.map((l, idx) => idx === i ? { ...l, amortizationSchedule: s } : l)
  )

  const isRented = form.status === 'rented'

  const handleSubmit = (e) => {
    e.preventDefault()
    const owners = (form.owners?.length ? form.owners : [{ name: 'Me', share: 1 }])
      .map((o) => ({ ...o, registrationTaxRate: o.registrationTaxRate != null ? o.registrationTaxRate : null }))

    // Aggregate registrationTax: sum of (share × rate × purchasePrice) per owner
    // Store as a blended rate on the property so downstream code still works
    const purchasePriceNum = Number(form.purchasePrice) || 0
    const totalRegTax = owners.reduce((sum, o) => {
      if (o.registrationTaxRate == null) return sum
      return sum + (Number(o.share) || 0) * o.registrationTaxRate * purchasePriceNum
    }, 0)
    const blendedRegRate = purchasePriceNum > 0 && owners.some((o) => o.registrationTaxRate != null)
      ? totalRegTax / purchasePriceNum
      : null

    const property = {
      ...form,
      _prePlannedStatus: undefined, // strip internal temp field
      owners,
      // Derive legacy isRented flag from status for backward compat
      isRented:              isRented,
      intendedRental:        isIntendedRental,
      status:                form.status,
      rentalStartDate:       form.rentalStartDate || '',
      rentalEndDate:         form.rentalEndDate || '',
      isPrimaryResidence:    form.isPrimaryResidence ?? false,
      residenceStartDate:    form.residenceStartDate || '',
      residenceEndDate:      form.residenceEndDate || '',
      purchasePrice:         purchasePriceNum,
      currentValue:          Number(form.currentValue) || 0,
      valuationDate:         form.valuationDate || '',
      appreciationRate:      Number(form.appreciationRate) || 0.02,
      // blended rate stored for backward compat with PropertyDetail cost calculations
      registrationTax:       blendedRegRate,
      notaryFees:            form.notaryFees       !== '' ? Number(form.notaryFees)       : null,
      agencyFees:            form.agencyFees       !== '' ? Number(form.agencyFees)       : null,
      otherAcquisitionCosts: form.otherAcquisitionCosts !== '' ? Number(form.otherAcquisitionCosts) : null,
      startRentalIncome:     Number(form.startRentalIncome) || 0,
      monthlyRentalIncome:   Number(form.startRentalIncome) || 0, // legacy sync
      indexationRate:        Number(form.indexationRate) || 0.02,
      vacancyRate:           Number(form.vacancyRate) || 0.05,
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
        <h2 className="text-xl font-bold text-neo-text">
          {isEdit ? 'Edit Property' : 'Add Property'}
        </h2>
        <button type="button" onClick={onCancel} className="text-neo-muted hover:text-neo-text">
          <CloseIcon />
        </button>
      </div>

      {/* ── Top-level toggles ── */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neo-text/95">Planned / simulated property</p>
            <p className="text-xs text-neo-subtle mt-0.5">
              Turn on for properties you don't own yet — projections include it but it won't affect today's cash flow.
            </p>
          </div>
          <Toggle checked={isPlanned} onChange={togglePlanned} label="" />
        </div>

        <div className="border-t border-neo-border/60 pt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neo-text/95">Will be rented out</p>
            <p className="text-xs text-neo-subtle mt-0.5">
              Show rental income fields. Set a start date if you're not renting yet.
            </p>
          </div>
          <Toggle checked={isIntendedRental} onChange={toggleIntendedRental} label="" />
        </div>
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

        <Field label="Valuation Date" hint="When was this estimate made? Used as the projection baseline.">
          <input className="input" type="date" value={form.valuationDate} onChange={si('valuationDate')} />
        </Field>

        <Field label="Annual Appreciation Rate"
          hint="Expected property value increase per year">
          <PctInput value={form.appreciationRate} onChange={sf('appreciationRate')} />
        </Field>

        <Field label="Purchase Date">
          <input className="input" type="date" value={form.purchaseDate} onChange={si('purchaseDate')} />
        </Field>
      </Section>

      {/* ── Section 1b: Acquisition Costs ── */}
      <Section title="Acquisition Costs">
        <Field label="Notary fees (EUR)"
          hint="Actual notary invoice total incl. VAT. Leave blank to auto-estimate (1% + €1,500).">
          <input className="input" type="number" min="0" placeholder="Auto-estimated"
            value={form.notaryFees} onChange={si('notaryFees')} />
        </Field>
        <Field label="Agency / broker fees (EUR)"
          hint="Estate agent commission paid by you at purchase.">
          <input className="input" type="number" min="0" placeholder="0"
            value={form.agencyFees} onChange={si('agencyFees')} />
        </Field>
        <Field label="Other acquisition costs (EUR)"
          hint="Architect, survey, moving costs, etc.">
          <input className="input" type="number" min="0" placeholder="0"
            value={form.otherAcquisitionCosts} onChange={si('otherAcquisitionCosts')} />
        </Field>
      </Section>

      {/* ── Section 2: Ownership ── */}
      <div className="card space-y-3">
        <div>
          <h3 className="section-title mb-0">Ownership</h3>
          <p className="text-xs text-neo-subtle mt-0.5">
            Who owns this property and what share. Shares must add up to 100%.
            Your personal net worth only counts your share.
          </p>
        </div>

        {/* Owner rows */}
        <div className="space-y-3">
          {(form.owners || [{ name: 'Me', share: 1 }]).map((owner, i) => {
            const owners = form.owners || [{ name: 'Me', share: 1 }]
            const updateOwner = (updated) => {
              const next = owners.map((o, idx) => idx === i ? updated : o)
              sf('owners')(next)
            }
            const removeOwner = () => sf('owners')(owners.filter((_, idx) => idx !== i))
            const totalShare  = owners.reduce((s, o) => s + (Number(o.share) || 0), 0)
            const isOver      = totalShare > 1.001

            // Determine if the current name matches a known member or is "other"
            const isKnownMember = memberNames.length === 0 || memberNames.includes(owner.name)
            const dropdownValue = isKnownMember ? (owner.name || '') : '__other__'

            return (
              <div key={i} className="border border-neo-border/60 rounded-xl p-3 space-y-2.5">
                {/* Row 1: name selector + share + remove */}
                <div className="flex items-center gap-2">
                  {/* Name — dropdown if household members exist, plain input otherwise */}
                  {memberNames.length > 0 ? (
                    <div className="flex-1 flex flex-col gap-1.5">
                      <select
                        className="input text-sm"
                        value={dropdownValue}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val !== '__other__') {
                            updateOwner({ ...owner, name: val })
                          } else {
                            updateOwner({ ...owner, name: '' })
                          }
                        }}
                      >
                        <option value="">— select owner —</option>
                        {memberNames.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                        <option value="__other__">Other…</option>
                      </select>
                      {/* Free-text fallback when "Other…" is chosen */}
                      {dropdownValue === '__other__' && (
                        <input
                          className="input text-sm"
                          placeholder="Owner name…"
                          value={owner.name}
                          onChange={(e) => updateOwner({ ...owner, name: e.target.value })}
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      className="input flex-1 text-sm"
                      placeholder={i === 0 ? 'Me' : 'Partner name…'}
                      value={owner.name}
                      onChange={(e) => updateOwner({ ...owner, name: e.target.value })}
                    />
                  )}

                  {/* Share % */}
                  <div className="relative w-24 shrink-0">
                    <input
                      className={`input pr-6 text-sm text-right w-full ${isOver ? 'border-red-500' : ''}`}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="50"
                      value={owner.share !== '' ? Math.round(Number(owner.share) * 100) : ''}
                      onChange={(e) => updateOwner({ ...owner, share: Number(e.target.value) / 100 })}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neo-muted text-xs">%</span>
                  </div>

                  {/* Remove button */}
                  {owners.length > 1 && (
                    <button
                      type="button"
                      onClick={removeOwner}
                      className="text-neo-subtle hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Row 2: registration tax rate for this owner */}
                <div>
                  <label className="label text-xs mb-1">
                    Registration tax rate for {owner.name || 'this owner'}
                  </label>
                  <PctInput
                    step="0.01"
                    placeholder="12"
                    value={owner.registrationTaxRate != null ? owner.registrationTaxRate : ''}
                    onChange={(v) => updateOwner({ ...owner, registrationTaxRate: v !== '' ? v : null })}
                  />
                  <p className="text-xs text-neo-subtle mt-1">
                    Standard: 12% (Flemish investment/rental). Enige eigen woning since 2025: 2%.
                    Leave blank to skip.
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Share validation + total */}
        {(() => {
          const owners     = form.owners || []
          const totalShare = owners.reduce((s, o) => s + (Number(o.share) || 0), 0)
          const isOver     = totalShare > 1.001
          const isUnder    = totalShare < 0.999 && owners.length > 1
          return (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => sf('owners')([...(form.owners || []), { name: '', share: 0 }])}
                className="text-neo-muted hover:text-brand-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add co-owner
              </button>
              <span className={`font-semibold ${isOver ? 'text-red-400' : isUnder ? 'text-amber-400' : 'text-emerald-400'}`}>
                Total: {Math.round(totalShare * 100)}%
                {isOver  && ' — exceeds 100%'}
                {isUnder && ' — under 100%'}
              </span>
            </div>
          )
        })()}
      </div>

      {/* ── Section 3: Current Status ── */}
      <div className="card space-y-4">
        <h3 className="section-title mb-0">Current Status</h3>
        <p className="text-xs text-neo-subtle -mt-2">
          What is the current situation with this property? This controls what shows in cash flow today.
        </p>
        <StatusSelector value={form.status} onChange={sf('status')} />

        {/* Primary residence toggle */}
        <div className="pt-2 border-t border-neo-border/60 space-y-3">
          <Toggle
            checked={form.isPrimaryResidence}
            onChange={sib('isPrimaryResidence')}
            label="This is (or will be) my primary residence"
          />
          {form.isPrimaryResidence && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0">
              <Field label="Living there from" hint="Leave blank if already living there">
                <input className="input" type="date"
                  value={form.residenceStartDate} onChange={si('residenceStartDate')} />
              </Field>
              <Field label="Moving out" hint="Leave blank if indefinite / ongoing">
                <input className="input" type="date"
                  value={form.residenceEndDate} onChange={si('residenceEndDate')} />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Rental Income & Period ── */}
      {isIntendedRental && (
        <div className="card space-y-4">
          <div>
            <h3 className="section-title mb-0">Rental Income &amp; Period</h3>
            <p className="text-xs text-neo-subtle mt-0.5">
              Set the expected rent and when the rental period starts — even if you're not renting yet.
              Cash flow only counts rent once the start date is reached and status is "Rented out".
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Monthly Rental Income (EUR)"
              hint="Gross rent — starting point for annual indexation">
              <input className="input" type="number" min="0" placeholder="1200"
                value={form.startRentalIncome} onChange={si('startRentalIncome')} />
            </Field>

            <Field label="Annual Rent Indexation Rate"
              hint="How much rent rises each year (Belgian health index ≈ 2%)">
              <PctInput value={form.indexationRate} onChange={sf('indexationRate')} />
            </Field>

            <Field label="Expected Vacancy Rate"
              hint="Average time property is vacant per year (5% = ~2 weeks). Reduces projected income.">
              <PctInput value={form.vacancyRate} onChange={sf('vacancyRate')} placeholder="5.0" />
            </Field>

            <div></div>

            <Field label="Rental start date"
              hint="When the tenant moves in / rental income begins. Leave blank if already renting.">
              <input className="input" type="date"
                value={form.rentalStartDate} onChange={si('rentalStartDate')} />
            </Field>

            <Field label="Rental end date"
              hint="When the current lease ends. Leave blank if open-ended.">
              <input className="input" type="date"
                value={form.rentalEndDate} onChange={si('rentalEndDate')} />
            </Field>
          </div>

          {/* Contextual notices */}
          {!isRented && form.rentalStartDate && (
            <div className="flex items-start gap-2 bg-neo-sunken/70 border border-neo-border rounded-xl px-3 py-2.5 text-xs text-neo-muted">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Rental date set. Switch status to <strong className="text-emerald-400">Rented out</strong> when the tenant moves in — that's when rent will appear in cash flow.
              </span>
            </div>
          )}
          {isRented && form.rentalStartDate && new Date(form.rentalStartDate) > new Date() && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200/80 rounded-2xl px-3 py-2.5 text-xs text-amber-900 shadow-neo-inset-sm">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                Rental income starts <strong>{new Date(form.rentalStartDate).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                Until then, cash flow shows €0 rental income — only costs.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Section 5: Operating Expenses ── */}
      <Section title="Operating Expenses">
        <Field label="Annual Maintenance Cost (EUR)"
          hint="Repairs, upkeep — inflated each year">
          <input className="input" type="number" min="0" placeholder="600"
            value={form.annualMaintenanceCost} onChange={si('annualMaintenanceCost')} />
          
          {/* Belgian Maintenance Estimation Helper */}
          <div className="mt-2 space-y-2">
            <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3 shadow-neo-inset-sm">
              <p className="text-xs font-semibold text-sky-900 mb-1.5">
                Belgian Maintenance Guidelines
              </p>
              <div className="text-xs text-sky-900/90 space-y-1">
                <p><strong>Apartments:</strong> €2,000-€2,500/year minimum (€30-35k over 15 years)</p>
                <p><strong>Houses:</strong> €2,500-€4,000/year minimum (€37.5-60k over 15 years)</p>
                <p className="text-sky-800 mt-2 pt-2 border-t border-sky-200/70">
                  <strong>Important:</strong> Plan for syndic special charges (bijzondere bijdragen) for roof, facade, elevator, or EPC renovations — these can reach €10-15k in a single call, especially with upcoming Flemish EPC requirements.
                </p>
              </div>
            </div>
            
            {/* Warning if below minimum */}
            {form.annualMaintenanceCost && Number(form.annualMaintenanceCost) < 2000 && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2 shadow-neo-inset-sm">
                <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-300">
                    Below Recommended Minimum
                  </p>
                  <p className="text-xs text-amber-200 mt-0.5">
                    Your estimate (€{Number(form.annualMaintenanceCost).toLocaleString()}/year = €{(Number(form.annualMaintenanceCost) * 15).toLocaleString()} over 15 years) is below the recommended minimum for Belgian properties. Consider increasing to avoid underestimating costs.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Field>

        <Field label="Annual Insurance Cost (EUR)"
          hint="Fire, liability — inflated each year">
          <input className="input" type="number" min="0" placeholder="400"
            value={form.annualInsuranceCost} onChange={si('annualInsuranceCost')} />
        </Field>

        <Field label="Annual Property Tax (EUR)"
          hint="Onroerende voorheffing — enter your current annual bill. In reality it rises yearly with KI indexation (≈inflation), but is kept fixed in this model.">
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

      {/* ── Section 6: Loans ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title mb-0">Loans</h3>
          <button type="button" onClick={addLoan} className="btn-secondary text-sm py-1.5">
            <PlusIcon />
            Add Loan
          </button>
        </div>

        {loans.length === 0 && (
          <p className="text-neo-subtle text-sm">No loans linked yet.</p>
        )}

        {loans.map((loan, i) => (
          <LoanForm key={loan.id} loan={loan} index={i}
            onChange={updateLoan} onRemove={removeLoan} onScheduleImport={importSchedule} />
        ))}
      </div>

      {/* ── Timeline preview ── */}
      {(loans.length > 0 || form.rentalStartDate || form.purchaseDate) && (
        <div className="card space-y-2">
          <h3 className="section-title mb-0">Timeline Preview</h3>
          <p className="text-xs text-neo-subtle">
            Live view — updates as you edit. Hover any year for financials.
          </p>
          <PropertyTimeline
            property={{
              ...form,
              purchasePrice:         Number(form.purchasePrice) || 0,
              currentValue:          Number(form.currentValue) || 0,
              appreciationRate:      Number(form.appreciationRate) || 0.02,
              startRentalIncome:     Number(form.startRentalIncome) || 0,
              monthlyRentalIncome:   Number(form.startRentalIncome) || 0,
              indexationRate:        Number(form.indexationRate) || 0.02,
              monthlyExpenses:       Number(form.monthlyExpenses) || 0,
              annualMaintenanceCost: Number(form.annualMaintenanceCost) || 0,
              annualInsuranceCost:   Number(form.annualInsuranceCost) || 0,
              annualPropertyTax:     Number(form.annualPropertyTax) || 0,
              inflationRate:         Number(form.inflationRate) || 0.02,
              loans: loans.map((l) => ({
                ...l,
                originalAmount: Number(l.originalAmount) || 0,
                termMonths:     Number(l.termMonths) || 0,
                monthlyPayment: Number(l.monthlyPayment) || 0,
                interestRate:   Number(l.interestRate) || 0,
              })),
            }}
          />
        </div>
      )}

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
