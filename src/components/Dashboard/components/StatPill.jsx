/**
 * StatPill — KPI stat card with an icon, label, value, and explanatory tooltip.
 * On desktop shows a hover tooltip; on mobile expands inline on tap.
 */

import { useState } from 'react'
import GlowCard from './GlowCard'
import { SOFT_EASE } from '../utils/constants'

export default function StatPill({ icon, label, value, explanation }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <GlowCard
      className="relative border border-white/[0.10] rounded-2xl px-4 py-4 flex-1 min-w-0"
      style={{ background: 'rgba(10, 14, 24, 0.38)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      transition={{ duration: 0.2, ease: SOFT_EASE }}
      glowSize={170}
      glowOpacity={0.14}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center shrink-0 text-brand-400">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-neo-muted truncate">{label}</p>
            {/* Mobile: tap to expand explanation */}
            <button
              type="button"
              className="sm:hidden text-neo-subtle hover:text-neo-muted transition-colors"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={`Explain ${label}`}
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Desktop: hover tooltip */}
            <span className="hidden sm:inline-flex items-center justify-center text-neo-subtle group relative">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span
                className="pointer-events-none absolute z-20 w-64 left-1/2 -translate-x-1/2 bottom-full mb-2
                           rounded-xl border border-white/[0.12] px-3 py-2 text-xs leading-relaxed text-neo-muted
                           opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ background: 'rgba(8, 12, 22, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              >
                {explanation}
              </span>
            </span>
          </div>
          <p className="text-base font-bold text-neo-text tabular-nums truncate">{value}</p>
        </div>
      </div>
      <div className={`sm:hidden mt-2 text-[11px] leading-relaxed text-neo-subtle ${expanded ? 'block' : 'hidden'}`}>
        {explanation}
      </div>
    </GlowCard>
  )
}
