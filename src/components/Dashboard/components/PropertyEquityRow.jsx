/**
 * PropertyEquityRow — a single property's 80% LTV equity headroom breakdown.
 */

import { motion } from 'motion/react'
import { kFmt } from '../utils/formatters'
import { SOFT_EASE } from '../utils/constants'

/**
 * @param {{ name: string, value: number, debt: number, headroom: number, ltvPct: number }} props
 */
export default function PropertyEquityRow({ name, value, debt, headroom, ltvPct }) {
  const ltvColor  = ltvPct < 60 ? '#10b981' : ltvPct < 75 ? '#f59e0b' : '#ef4444'
  const maxBorrow = value * 0.80

  return (
    <motion.div
      className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18, ease: SOFT_EASE }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neo-text truncate leading-tight">{name}</p>
        <p className="text-[10px] text-neo-icon font-mono mt-0.5 truncate">
          {kFmt(maxBorrow)} − {kFmt(debt)} = <span style={{ color: '#fb923c' }}>{kFmt(headroom)}</span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-neo-sunken rounded-full overflow-hidden" style={{ maxWidth: '80px' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, ltvPct)}%`, background: ltvColor, boxShadow: `0 0 6px ${ltvColor}66` }}
            />
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: ltvColor }}>{ltvPct.toFixed(0)}% LTV</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-brand-400 tabular-nums">{kFmt(headroom)}</p>
        <p className="text-[10px] text-neo-subtle">available</p>
      </div>
    </motion.div>
  )
}
