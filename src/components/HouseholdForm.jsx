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
import { computePositions } from '../calculations/trading/tradingUtils'

// Default annual return rates by common position type (user can override)
const DEFAULT_RETURN = 0.07   // 7% — broad market ETF baseline

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

// ─── Investment position row ──────────────────────────────────────────────────

function PositionRow({ pos, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
      {/* Name */}
      <input
        type="text"
        value={pos.name}
        onChange={(e) => onChange({ ...pos, name: e.target.value })}
        placeholder="e.g. SPYI Global, Pension Fund…"
        className="input text-sm"
      />
      {/* Monthly contribution */}
      <div className="relative w-28">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">€</span>
        <input
          type="number"
          min="0"
          step="1"
          value={pos.monthlyAmount === 0 ? '' : pos.monthlyAmount}
          onChange={(e) => onChange({ ...pos, monthlyAmount: num(e.target.value) })}
          placeholder="0"
          className="input pl-6 pr-2 text-sm w-full"
          title="Monthly contribution"
        />
      </div>
      {/* Expected annual return */}
      <div className="relative w-20">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={pos.annualReturn === 0 ? '' : +(pos.annualReturn * 100).toFixed(1)}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            onChange({ ...pos, annualReturn: isNaN(n) ? 0 : n / 100 })
          }}
          placeholder="7"
          className="input pr-6 text-sm w-full"
          title="Expected annual return %"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
      </div>
      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
        title="Remove position"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member, onChange, onRemove, onSetMe, canRemove, tradingPortfolioValue }) {
  const set = (key) => (value) => onChange({ ...member, [key]: value })
  const positions = member.investmentPositions || []

  const addPosition = () => {
    onChange({
      ...member,
      investmentPositions: [
        ...positions,
        { id: uuidv4(), name: '', monthlyAmount: 0, annualReturn: DEFAULT_RETURN },
      ],
    })
  }

  const updatePosition = (id, updated) => {
    onChange({
      ...member,
      investmentPositions: positions.map((p) => (p.id === id ? updated : p)),
    })
  }

  const removePosition = (id) => {
    onChange({ ...member, investmentPositions: positions.filter((p) => p.id !== id) })
  }

  const totalMonthlyInvested = positions.reduce((s, p) => s + (p.monthlyAmount || 0), 0)

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
      {/* Name row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          title={member.isMe ? 'This is you' : 'Mark as me'}
          onClick={onSetMe}
          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 font-bold text-sm transition-all
            ${member.isMe
              ? 'bg-brand-600/40 border-brand-500 text-brand-200'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-brand-500 hover:text-brand-400'}`}
        >
          {member.isMe ? '★' : (member.name || '?').charAt(0).toUpperCase()}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={member.name}
            onChange={(e) => onChange({ ...member, name: e.target.value })}
            placeholder="Name (e.g. Me, Sarah…)"
            className="input w-full text-sm font-medium"
          />
          {member.isMe && (
            <p className="text-[10px] text-brand-400 mt-0.5 ml-0.5">
              ★ Your personal net worth includes this member's cash &amp; investments
            </p>
          )}
        </div>
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
        <Field label="Investment Income" hint="Monthly dividends / realised gains (optional)">
          <MoneyInput value={member.investmentIncome} onChange={set('investmentIncome')} />
        </Field>
        <Field label="Available Cash" hint="Lump-sum savings on hand">
          <MoneyInput value={member.cash} onChange={set('cash')} />
        </Field>
      </div>

      {/* ── Investment positions ── */}
      <div className="space-y-2 pt-1 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400">Investment Positions</p>
          {totalMonthlyInvested > 0 && (
            <span className="text-xs text-emerald-400 font-semibold">
              €{totalMonthlyInvested.toLocaleString('nl-BE')}/mo total
            </span>
          )}
        </div>

        {positions.length > 0 && (
          <div className="space-y-1.5">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-slate-500 px-0.5">
              <span>Name / ticker</span>
              <span className="w-28 text-center">Monthly (€)</span>
              <span className="w-20 text-center">Return %</span>
              <span className="w-4" />
            </div>
            {positions.map((pos) => (
              <PositionRow
                key={pos.id}
                pos={pos}
                onChange={(updated) => updatePosition(pos.id, updated)}
                onRemove={() => removePosition(pos.id)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addPosition}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-400 transition-colors py-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add position
        </button>
      </div>

      {/* Inline totals */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1 border-t border-slate-700/50">
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
        {totalMonthlyInvested > 0 && (
          <span>
            Investing:{' '}
            <span className="text-amber-400 font-semibold">
              €{totalMonthlyInvested.toLocaleString('nl-BE')}/mo
            </span>
          </span>
        )}
      </div>

      {/* Trading portfolio summary — shown only on the owner (isMe) card */}
      {member.isMe && tradingPortfolioValue > 0 && (
        <div className="pt-2 border-t border-slate-700/50">
          <div className="flex items-center justify-between gap-2 bg-violet-900/20 border border-violet-700/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="text-xs text-violet-300 font-medium">Revolut trading portfolio</span>
            </div>
            <span className="text-sm font-bold text-violet-300 tabular-nums">
              €{tradingPortfolioValue.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 ml-0.5">
            Included in your personal net worth on the Dashboard
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseholdForm({ profile, onSave, saving, trades = [], tradingPortfolioValue = 0 }) {
  const [form, setForm] = useState({ ...profile })

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  // ── Member helpers ──
  const addMember = () => {
    setForm((f) => ({
      ...f,
      members: [
        ...f.members,
        { id: uuidv4(), name: '', netIncome: 0, investmentIncome: 0, cash: 0, isMe: false },
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
              onSetMe={() => setForm((f) => ({
                ...f,
                members: f.members.map((mm) => ({ ...mm, isMe: mm.id === m.id })),
              }))}
              canRemove={form.members.length > 1 && !m.isMe}
              tradingPortfolioValue={tradingPortfolioValue}
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

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}
