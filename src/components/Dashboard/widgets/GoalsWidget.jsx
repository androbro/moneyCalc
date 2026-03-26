/**
 * GoalsWidget — capital goals with dual progress bars (current vs projected).
 * Users can add, edit, and delete goals.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { motion } from 'motion/react'
import { WidgetConfig } from '../WidgetConfig'
import { kFmt } from '../utils/formatters'
import { SOFT_EASE } from '../utils/constants'

export const widgetConfig = new WidgetConfig({
  id:             'goals',
  title:          'Goals',
  description:    'Investment-ready capital targets with current vs projected progress',
  category:       'planning',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 8, y: 9, w: 4, h: 6 },
    md: { x: 4, y: 26, w: 4, h: 6 },
    sm: { x: 0, y: 34, w: 4, h: 6 },
    xs: { x: 0, y: 34, w: 4, h: 6 },
  },
  minW: 3,
  minH: 4,
})

function GoalItem({ goal, investmentReadyCapital, projectedInvestmentReadyByYear, onEdit, onDelete }) {
  const projected   = projectedInvestmentReadyByYear.get(Number(goal.targetYear)) ?? investmentReadyCapital
  const pct         = Math.max(0, Math.min(100, (projected / (goal.targetAmount || 1)) * 100))
  const currentPct  = Math.max(0, Math.min(100, (investmentReadyCapital / (goal.targetAmount || 1)) * 100))
  const remaining   = Math.max(0, goal.targetAmount - projected)

  return (
    <motion.div
      className="group rounded-2xl px-3 py-3 border border-white/[0.08]"
      style={{ background: 'rgba(4,7,14,0.35)' }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18, ease: SOFT_EASE }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neo-muted">By {goal.targetYear}: {kFmt(goal.targetAmount)} ready capital</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neo-text tabular-nums">{Math.round(pct)}%</span>
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(goal)}
              className="w-6 h-6 rounded-lg text-neo-subtle hover:text-brand-300 hover:bg-white/[0.06] transition-colors flex items-center justify-center"
              aria-label="Edit goal"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onDelete(goal.id)}
              className="w-6 h-6 rounded-lg text-neo-subtle hover:text-red-400 hover:bg-white/[0.06] transition-colors flex items-center justify-center"
              aria-label="Delete goal"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="relative h-2 bg-neo-sunken rounded-full mt-2 overflow-hidden">
        <div className="absolute left-0 top-0 h-full rounded-l-full" style={{ width: `${Math.min(currentPct, pct)}%`, background: '#10b981' }} />
        {pct > currentPct && (
          <div className="absolute top-0 h-full" style={{ left: `${currentPct}%`, width: `${pct - currentPct}%`, background: 'linear-gradient(90deg, #ea580c, #f59e0b)' }} />
        )}
      </div>

      <p className="text-[10px] text-neo-subtle mt-2">
        Current: <span className="text-neo-muted">{kFmt(investmentReadyCapital)}</span>
        {' · '}
        Projected: <span className="text-neo-muted">{kFmt(projected)}</span>
        {' · '}
        {remaining > 0
          ? <>Gap: <span className="text-red-400">{kFmt(remaining)}</span></>
          : <span className="text-emerald-400">On track</span>}
      </p>
    </motion.div>
  )
}

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function GoalsWidget({ ctx }) {
  const { capitalGoals, investmentReadyCapital, projectedInvestmentReadyByYear, onOpenGoalModal, onDeleteGoal } = ctx

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onOpenGoalModal(null)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
        >
          + Add goal
        </button>
      </div>

      {capitalGoals.length === 0 ? (
        <p className="text-xs text-neo-subtle">No goals yet. Add one to track target capital by year.</p>
      ) : (
        <div className="space-y-3">
          {capitalGoals.map((g) => (
            <GoalItem
              key={g.id}
              goal={g}
              investmentReadyCapital={investmentReadyCapital}
              projectedInvestmentReadyByYear={projectedInvestmentReadyByYear}
              onEdit={onOpenGoalModal}
              onDelete={onDeleteGoal}
            />
          ))}
        </div>
      )}
    </div>
  )
}
