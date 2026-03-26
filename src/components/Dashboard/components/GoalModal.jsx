/**
 * GoalModal — modal form to add or edit an investment-ready capital goal.
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { SOFT_EASE } from '../utils/constants'

/**
 * @param {{
 *   onClose: () => void,
 *   onSave: (goal: Object) => void,
 *   defaultYear: number,
 *   initialGoal?: Object|null
 * }} props
 */
export default function GoalModal({ onClose, onSave, defaultYear, initialGoal = null }) {
  const [targetYear,    setTargetYear]    = useState(initialGoal?.targetYear ?? defaultYear)
  const [targetCapital, setTargetCapital] = useState(initialGoal?.targetAmount ?? 50000)

  function submit(e) {
    e.preventDefault()
    if (!targetYear || targetCapital <= 0) return
    onSave({
      id:           initialGoal?.id ?? crypto.randomUUID(),
      type:         'investment_ready_capital',
      targetYear:   Number(targetYear),
      targetAmount: Number(targetCapital),
      createdAt:    initialGoal?.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: SOFT_EASE }}
    >
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />
      <motion.form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-3xl border border-white/[0.12] p-5 space-y-4"
        style={{ background: 'rgba(8,12,22,0.96)' }}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: SOFT_EASE }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-neo-text">{initialGoal ? 'Edit Goal' : 'Add Goal'}</h3>
            <p className="text-xs text-neo-subtle mt-0.5">Target investment-ready capital by a specific year.</p>
          </div>
          <button type="button" onClick={onClose} className="text-neo-subtle hover:text-neo-text">✕</button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neo-muted">Target year</label>
          <input
            type="number"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 40}
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
            className="input w-full"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neo-muted">Required capital (€)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neo-subtle text-sm">€</span>
            <input
              type="number" min={0} step={1000}
              value={targetCapital}
              onChange={(e) => setTargetCapital(Number(e.target.value || 0))}
              className="input w-full pl-7"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs rounded-xl border border-white/[0.12] text-neo-muted hover:text-neo-text">
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs">
            {initialGoal ? 'Update Goal' : 'Save Goal'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
