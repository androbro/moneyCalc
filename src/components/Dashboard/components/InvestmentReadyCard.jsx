/**
 * InvestmentReadyCard — the orange hero card showing total investment-ready capital.
 * Collapsible breakdown on mobile; always-visible on sm+.
 */

import { useState } from 'react'
import { kFmt } from '../utils/formatters'
import { formatEUR } from '../../../utils/projectionUtils'

/**
 * @param {{ total: number, equityPart: number, cashPart: number }} props
 */
export default function InvestmentReadyCard({ total, equityPart, cashPart }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="relative rounded-3xl p-5 overflow-hidden border border-brand-500/20"
      style={{
        background: 'linear-gradient(135deg, rgba(234,88,12,0.18) 0%, rgba(194,65,12,0.10) 60%, rgba(10,14,24,0.38) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 0 40px rgba(234,88,12,0.12), 0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%)' }} />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Left: big number */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style={{ boxShadow: '0 0 8px rgba(234,88,12,0.8)' }} />
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Investment Ready Capital</p>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-neo-text tabular-nums leading-none mb-2"
            style={{ textShadow: '0 0 30px rgba(234,88,12,0.3)' }}>
            {formatEUR(total)}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-neo-muted">Available for your next property acquisition</p>
            <button
              onClick={() => setExpanded(e => !e)}
              className="sm:hidden flex items-center gap-1 text-[10px] text-neo-subtle hover:text-neo-muted transition-colors shrink-0"
            >
              <span>{expanded ? 'less' : 'how?'}</span>
              <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right: breakdown — always sm+, collapsible on mobile */}
        <div className={`sm:w-72 shrink-0 space-y-2 sm:block ${expanded ? 'block' : 'hidden'}`}>
          <div className="rounded-2xl px-3 py-2.5 space-y-1.5"
            style={{ background: 'rgba(4,7,14,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span className="text-xs text-neo-subtle">Reusable property equity</span>
                <p className="text-[10px] text-neo-icon mt-0.5 font-mono">Σ (value × 80%) − debt</p>
              </div>
              <span className="text-xs font-semibold text-neo-text tabular-nums shrink-0">{kFmt(equityPart)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-neo-subtle">Liquid savings</span>
              <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(cashPart)}</span>
            </div>
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-neo-muted">Total ready</span>
              <span className="text-xs font-bold text-brand-400 tabular-nums">{kFmt(total)}</span>
            </div>
            <p className="text-[10px] text-neo-subtle leading-relaxed pt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              Use for: <span className="text-neo-muted">12% registration tax</span> or <span className="text-neo-muted">20% own contribution</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
