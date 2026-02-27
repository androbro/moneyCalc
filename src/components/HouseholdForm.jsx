/**
 * HouseholdForm.jsx — Phase 8
 *
 * Editable form for the single household financial profile:
 *   • Your income (salary + investment/trading)
 *   • Partner income + available cash
 *   • Joint household expenses + personal savings rate
 *   • Next property acquisition target
 *   • New primary residence details (joint purchase with partner)
 *
 * Props:
 *   profile  – current household profile object (defaultHousehold() shape)
 *   onSave   – async (profile) => void
 *   saving   – boolean, disables form while saving
 */

import { useState } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function pct(v) {
  // Accept either 0–1 or 0–100; normalise to 0–1
  const n = parseFloat(String(v).replace(',', '.'))
  if (isNaN(n)) return 0
  return n > 1 ? n / 100 : n
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder = '0' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">€</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(num(e.target.value))}
        placeholder={placeholder}
        className="input pl-7 w-full"
      />
    </div>
  )
}

function PctInput({ value, onChange }) {
  // Display as percentage (0–100), store as fraction (0–1)
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        max="100"
        step="1"
        value={value === 0 ? '' : +(value * 100).toFixed(1)}
        onChange={(e) => onChange(pct(e.target.value))}
        placeholder="10"
        className="input pr-7 w-full"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseholdForm({ profile, onSave, saving }) {
  const [form, setForm] = useState({ ...profile })

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Household Financial Profile</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Your combined income and cost picture — used by the Cash-Flow Aggregator and AI Insights.
        </p>
      </div>

      {/* ── Your income ── */}
      <Section title="Your Income (monthly net)">
        <Field label="Your Net Salary" hint="Take-home pay after tax and social contributions">
          <MoneyInput value={form.myNetIncome} onChange={set('myNetIncome')} />
        </Field>
        <Field label="Investment / Trading Income" hint="Average monthly net from stocks, dividends, or active trading">
          <MoneyInput value={form.myInvestmentIncome} onChange={set('myInvestmentIncome')} />
        </Field>
      </Section>

      {/* ── Partner ── */}
      <Section title="Partner">
        <Field label="Partner Net Salary (monthly)" hint="Her take-home pay after tax">
          <MoneyInput value={form.partnerNetIncome} onChange={set('partnerNetIncome')} />
        </Field>
        <Field label="Partner Available Cash (lump sum)" hint="Cash she can contribute towards the new primary residence">
          <MoneyInput value={form.partnerCash} onChange={set('partnerCash')} />
        </Field>
      </Section>

      {/* ── Household costs & savings ── */}
      <Section title="Household Costs & Savings">
        <Field label="Joint Monthly Expenses" hint="Rent (current), food, utilities, transport, subscriptions…">
          <MoneyInput value={form.householdExpenses} onChange={set('householdExpenses')} />
        </Field>
        <Field label="Personal Savings Rate" hint="Fraction of total net income kept aside each month (e.g. 15%)">
          <PctInput value={form.personalSavingsRate} onChange={set('personalSavingsRate')} />
        </Field>
      </Section>

      {/* ── Next acquisition target ── */}
      <Section title="Next Rental Property — Acquisition Target">
        <Field label="Target Down Payment (€)" hint="Cash you need to save for the next rental property purchase">
          <MoneyInput value={form.targetDownPayment} onChange={set('targetDownPayment')} />
        </Field>
        <Field label="Target Purchase Year" hint="Calendar year you plan to buy the next rental property">
          <input
            type="number"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 30}
            value={form.targetPurchaseYear ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, targetPurchaseYear: e.target.value ? parseInt(e.target.value) : null }))
            }
            placeholder={String(new Date().getFullYear() + 3)}
            className="input w-full"
          />
        </Field>
      </Section>

      {/* ── New primary residence (joint with partner) ── */}
      <Section title="New Primary Residence (Joint Purchase with Partner)">
        <Field label="Purchase Price" hint="Agreed or expected price of the new home">
          <MoneyInput value={form.newResidencePrice} onChange={set('newResidencePrice')} />
        </Field>
        <Field label="Joint Loan Amount" hint="Total mortgage you and your partner will take together">
          <MoneyInput value={form.newResidenceLoanAmount} onChange={set('newResidenceLoanAmount')} />
        </Field>
        <Field label="Estimated Monthly Payment" hint="Estimated combined monthly mortgage repayment">
          <MoneyInput value={form.newResidenceMonthlyPayment} onChange={set('newResidenceMonthlyPayment')} />
        </Field>
        <Field label="Planned Purchase Date" hint="Approximate settlement or notary date">
          <input
            type="date"
            value={form.newResidencePurchaseDate ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, newResidencePurchaseDate: e.target.value }))}
            className="input w-full"
          />
        </Field>
      </Section>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}
