/**
 * HouseholdForm.jsx — Phase 8b
 *
 * Household Financial Profile editor.
 * Members section: dynamic list — add / remove / rename any member and
 * set their monthly net salary, investment income, and available cash.
 *
 * Props:
 *   profile  – current household profile object
 *   onSave   – async (profile) => void
 *   saving   – boolean
 */

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function pct(v) {
  const n = parseFloat(String(v).replace(',', '.'))
  if (isNaN(n)) return 0
  return n > 1 ? n / 100 : n
}

// ─── Shared field components ──────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder = '0', disabled = false }) {
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
        disabled={disabled}
        className="input pl-7 w-full"
      />
    </div>
  )
}

function PctInput({ value, onChange }) {
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

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member, onChange, onRemove, canRemove }) {
  const set = (key) => (value) => onChange({ ...member, [key]: value })

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
      {/* Name row */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/40
                        flex items-center justify-center shrink-0 text-brand-300 font-bold text-sm">
          {(member.name || '?').charAt(0).toUpperCase()}
        </div>
        <input
          type="text"
          value={member.name}
          onChange={(e) => onChange({ ...member, name: e.target.value })}
          placeholder="Name (e.g. Me, Sarah…)"
          className="input flex-1 text-sm font-medium"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title="Remove member"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Financial fields — 3 columns on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Net Monthly Salary" hint="After tax">
          <MoneyInput value={member.netIncome} onChange={set('netIncome')} />
        </Field>
        <Field label="Investment Income" hint="Monthly avg (stocks, dividends…)">
          <MoneyInput value={member.investmentIncome} onChange={set('investmentIncome')} />
        </Field>
        <Field label="Available Cash" hint="Lump-sum savings on hand">
          <MoneyInput value={member.cash} onChange={set('cash')} />
        </Field>
      </div>

      {/* Inline totals */}
      <div className="flex gap-4 text-xs text-slate-500 pt-1 border-t border-slate-700/50">
        <span>
          Monthly income:{' '}
          <span className="text-emerald-400 font-semibold">
            €{((member.netIncome || 0) + (member.investmentIncome || 0)).toLocaleString('nl-BE')}
          </span>
        </span>
        <span>
          Cash:{' '}
          <span className="text-brand-400 font-semibold">
            €{(member.cash || 0).toLocaleString('nl-BE')}
          </span>
        </span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseholdForm({ profile, onSave, saving }) {
  const [form, setForm] = useState({ ...profile })

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  // ── Member helpers ──
  const addMember = () => {
    setForm((f) => ({
      ...f,
      members: [
        ...f.members,
        { id: uuidv4(), name: '', netIncome: 0, investmentIncome: 0, cash: 0 },
      ],
    }))
  }

  const updateMember = (id, updated) => {
    setForm((f) => ({
      ...f,
      members: f.members.map((m) => (m.id === id ? updated : m)),
    }))
  }

  const removeMember = (id) => {
    setForm((f) => ({ ...f, members: f.members.filter((m) => m.id !== id) }))
  }

  // ── Derived totals for the summary strip ──
  const totalMonthlyIncome = form.members.reduce(
    (s, m) => s + (m.netIncome || 0) + (m.investmentIncome || 0), 0
  )
  const totalCash = form.members.reduce((s, m) => s + (m.cash || 0), 0)

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
          All members' income and cash — used by the Cash-Flow Aggregator and AI Insights.
        </p>
      </div>

      {/* ── Members ── */}
      <Section title="Household Members">
        {/* Summary strip */}
        {form.members.length > 0 && (
          <div className="flex gap-6 px-1 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Combined monthly income </span>
              <span className="text-emerald-400 font-semibold">
                €{totalMonthlyIncome.toLocaleString('nl-BE')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Total cash on hand </span>
              <span className="text-brand-400 font-semibold">
                €{totalCash.toLocaleString('nl-BE')}
              </span>
            </div>
          </div>
        )}

        {/* Member cards */}
        <div className="space-y-3">
          {form.members.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">
              No members yet — add yourself and your partner below.
            </p>
          )}
          {form.members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onChange={(updated) => updateMember(m.id, updated)}
              onRemove={() => removeMember(m.id)}
              canRemove={form.members.length > 1}
            />
          ))}
        </div>

        {/* Add member */}
        <button
          type="button"
          onClick={addMember}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed
                     border-slate-600 hover:border-brand-500 text-slate-400 hover:text-brand-400
                     rounded-xl text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add member
        </button>
      </Section>

      {/* ── Household costs & savings ── */}
      <Section title="Household Costs & Savings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Joint Monthly Expenses" hint="Rent, food, utilities, transport, subscriptions…">
            <MoneyInput value={form.householdExpenses} onChange={set('householdExpenses')} />
          </Field>
          <Field label="Personal Savings Rate" hint="Fraction of total income set aside each month (e.g. 15%)">
            <PctInput value={form.personalSavingsRate} onChange={set('personalSavingsRate')} />
          </Field>
        </div>
      </Section>

      {/* ── Next acquisition target ── */}
      <Section title="Next Rental Property — Acquisition Target">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Target Down Payment (€)" hint="Cash needed for the next rental property purchase">
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
        </div>
      </Section>

      {/* ── New primary residence ── */}
      <Section title="New Primary Residence (Joint Purchase)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Purchase Price" hint="Agreed or expected price of the new home">
            <MoneyInput value={form.newResidencePrice} onChange={set('newResidencePrice')} />
          </Field>
          <Field label="Joint Loan Amount" hint="Total mortgage taken together">
            <MoneyInput value={form.newResidenceLoanAmount} onChange={set('newResidenceLoanAmount')} />
          </Field>
          <Field label="Estimated Monthly Payment" hint="Combined monthly mortgage repayment">
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
        </div>
      </Section>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}
