/**
 * GoalBar — animated horizontal progress bar with label and percentage.
 */

import { motion } from 'motion/react'
import { SOFT_EASE } from '../utils/constants'

/**
 * @param {{ label: string, pct: number, color?: string }} props
 */
export default function GoalBar({ label, pct, color = '#ea580c' }) {
  const clamped = Math.min(100, Math.max(0, pct))

  return (
    <motion.div
      className="space-y-1.5"
      whileHover={{ scale: 1.012 }}
      transition={{ duration: 0.18, ease: SOFT_EASE }}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm text-neo-muted">{label}</span>
        <span className="text-sm font-semibold text-neo-text tabular-nums">{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 bg-neo-sunken rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, ease: SOFT_EASE }}
          style={{
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            boxShadow: `0 0 10px ${color}55`,
          }}
        />
      </div>
    </motion.div>
  )
}
