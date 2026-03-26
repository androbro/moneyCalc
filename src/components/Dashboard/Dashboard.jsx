/**
 * Dashboard — top-level orchestrator for the portfolio dashboard.
 *
 * Responsibilities (Single Responsibility: data + state only):
 *   - Compute the DashboardContext object from raw props
 *   - Hold transient UI state (settings panel, goal modal)
 *   - Delegate all rendering to DashboardGrid and DashboardSettingsPanel
 *
 * This file must stay under 300 lines. Business logic lives in utils/,
 * UI components in components/, and widget layout in DashboardGrid.
 *
 * @see interfaces.js for the full DashboardContext typedef
 * @see DASHBOARD_WIDGETS.md to add new widgets
 */

import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { computeSummary, getRemainingBalance } from '../../utils/projectionUtils'
import { computeHealthScore } from './utils/healthScore'
import { generateInvestmentReadyProjection } from './utils/chartGenerators'
import { LTV_MAX } from './utils/constants'
import EmptyState from './components/EmptyState'
import GoalModal  from './components/GoalModal'
import DashboardGrid          from './DashboardGrid'
import DashboardSettingsPanel from './DashboardSettingsPanel'

// ─── Icons ─────────────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard({
  properties,
  profile,
  onAddProperty,
  onSaveProfile,
  tradingPortfolioValue = 0,
}) {
  const [settingsOpen,    setSettingsOpen]    = useState(false)
  const [goalModalOpen,   setGoalModalOpen]   = useState(false)
  const [goalBeingEdited, setGoalBeingEdited] = useState(null)

  // ── Computed summary ────────────────────────────────────────
  const summary = computeSummary(properties, profile, { tradingPortfolioValue })
  const ltv     = summary.totalPortfolioValue > 0
    ? (summary.totalDebt / summary.totalPortfolioValue) * 100
    : null
  const healthScore = useMemo(
    () => computeHealthScore(ltv, summary.totalMonthlyCashFlow, summary.propertyCount),
    [ltv, summary.totalMonthlyCashFlow, summary.propertyCount]
  )

  // ── Investment Ready Capital ────────────────────────────────
  const availableEquity = useMemo(() => {
    const todayISO = new Date().toISOString()
    return properties
      .filter(p => p.status !== 'planned')
      .reduce((sum, p) => {
        const debt = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, todayISO), 0)
        return sum + Math.max(0, (p.currentValue || 0) * LTV_MAX - debt)
      }, 0)
  }, [properties])

  const liquidCash              = summary.personalCash || 0
  const investmentReadyCapital  = availableEquity + liquidCash
  const buyPowerConservative    = investmentReadyCapital * 5
  const buyPowerLeveraged       = investmentReadyCapital * 10

  // ── Per-property equity rows ────────────────────────────────
  const propertyEquityRows = useMemo(() => {
    const todayISO = new Date().toISOString()
    return properties
      .filter(p => p.status !== 'planned')
      .map(p => {
        const debt     = (p.loans || []).reduce((s, l) => s + getRemainingBalance(l, todayISO), 0)
        const value    = p.currentValue || 0
        const headroom = Math.max(0, value * LTV_MAX - debt)
        const ltvPct   = value > 0 ? (debt / value) * 100 : 0
        return { name: p.name || p.address || 'Property', value, debt, headroom, ltvPct }
      })
      .sort((a, b) => b.headroom - a.headroom)
  }, [properties])

  // ── Goals & projections ─────────────────────────────────────
  const capitalGoals = Array.isArray(profile?.capitalGoals) ? profile.capitalGoals : []

  const projectedInvestmentReadyByYear = useMemo(() => {
    const nowYear = new Date().getFullYear()
    const points  = generateInvestmentReadyProjection(properties, liquidCash, 25)
    return new Map(points.map(p => [nowYear + p.year, p.value]))
  }, [properties, liquidCash])

  // ── Profile display ──────────────────────────────────────────
  const profileName = useMemo(() => {
    if (profile?.members?.length) {
      const me = profile.members.find(m => m.isMe) ?? profile.members[0]
      if (me?.name) return me.name
    }
    return 'My Portfolio'
  }, [profile])

  const profileInitials = profileName.slice(0, 2).toUpperCase()

  // ── Goal handlers ────────────────────────────────────────────
  async function handleSaveGoal(goal) {
    if (!onSaveProfile || !profile) return
    const exists    = capitalGoals.some(g => g.id === goal.id)
    const nextGoals = exists
      ? capitalGoals.map(g => g.id === goal.id ? { ...g, ...goal } : g)
      : [...capitalGoals, goal]
    await onSaveProfile({ ...profile, capitalGoals: nextGoals })
    setGoalBeingEdited(null)
    setGoalModalOpen(false)
  }

  async function handleDeleteGoal(goalId) {
    if (!onSaveProfile || !profile) return
    await onSaveProfile({ ...profile, capitalGoals: capitalGoals.filter(g => g.id !== goalId) })
  }

  function handleOpenGoalModal(goalToEdit = null) {
    setGoalBeingEdited(goalToEdit)
    setGoalModalOpen(true)
  }

  // ── Empty state ──────────────────────────────────────────────
  if (properties.length === 0) {
    return <EmptyState onAddProperty={onAddProperty} />
  }

  // ── Build context ─────────────────────────────────────────────
  /** @type {import('./interfaces').DashboardContext} */
  const ctx = {
    properties,
    profile,
    tradingPortfolioValue,
    summary,
    ltv,
    healthScore,
    investmentReadyCapital,
    availableEquity,
    liquidCash,
    buyPowerConservative,
    buyPowerLeveraged,
    propertyEquityRows,
    projectedInvestmentReadyByYear,
    capitalGoals,
    onOpenGoalModal:  handleOpenGoalModal,
    onDeleteGoal:     handleDeleteGoal,
    onSaveProfile,
    onAddProperty,
    profileName,
    profileInitials,
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1
          className="text-5xl text-neo-text"
          style={{ fontFamily: "'Satisfy', cursive", textShadow: '0 0 30px rgba(234,88,12,0.25)' }}
        >
          wenLambo
        </h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.10]
                     text-neo-subtle hover:text-neo-text hover:border-white/[0.20] transition-colors text-xs"
          title="Customize dashboard"
        >
          <GearIcon />
          <span className="hidden sm:inline">Customize</span>
        </button>
      </div>

      {/* Widget grid */}
      <DashboardGrid ctx={ctx} onSaveProfile={onSaveProfile} />

      {/* Settings panel */}
      <DashboardSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        onSaveProfile={onSaveProfile}
      />

      {/* Goal modal (triggered by GoalsWidget via ctx.onOpenGoalModal) */}
      <AnimatePresence>
        {goalModalOpen && (
          <GoalModal
            onClose={() => setGoalModalOpen(false)}
            onSave={handleSaveGoal}
            defaultYear={new Date().getFullYear() + 3}
            initialGoal={goalBeingEdited}
          />
        )}
      </AnimatePresence>
    </>
  )
}
