/**
 * ChartPickerDropdown — dropdown menu for switching between chart types.
 */

import { AnimatePresence, motion } from 'motion/react'
import { CHARTS, SOFT_EASE } from '../../utils/constants'
import { kFmt } from '../../utils/formatters'

/**
 * @param {{
 *   open: boolean,
 *   activeChart: string,
 *   onSelect: (id: string) => void,
 *   includedLoanKeys: Set,
 *   loanOptions: Array,
 *   includedLoanMonthlyEstimate: number,
 *   currentExpenseBreakdown: Object,
 * }} props
 */
export default function ChartPickerDropdown({
  open, activeChart, onSelect,
  includedLoanKeys, loanOptions,
  includedLoanMonthlyEstimate, currentExpenseBreakdown,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute left-0 top-14 z-[120] rounded-2xl border border-white/[0.10] overflow-visible shadow-2xl"
          style={{ background: 'rgba(8,12,22,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', minWidth: '220px' }}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: SOFT_EASE }}
        >
          {CHARTS.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full flex flex-col items-start px-4 py-3 text-left transition-colors
                first:rounded-t-2xl last:rounded-b-2xl hover:bg-white/[0.06]
                ${activeChart === c.id ? 'bg-brand-600/10' : ''}`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`text-sm font-medium ${activeChart === c.id ? 'text-brand-400' : 'text-neo-text'}`}>
                  {c.label}
                </span>
                {c.id === 'cashflow' && (
                  <span className="relative inline-flex items-center justify-center text-neo-subtle group/info">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span
                      className="pointer-events-none absolute z-[140] left-full top-1/2 ml-2 -translate-y-1/2 w-64
                                 rounded-xl border border-white/[0.12] px-3 py-2 text-[11px] leading-relaxed text-neo-muted
                                 opacity-0 group-hover/info:opacity-100 transition-opacity duration-150"
                      style={{ background: 'rgba(8, 12, 22, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
                    >
                      Net monthly: Rent − opex − selected loans<br />
                      Included: <span className="text-neo-text">{includedLoanKeys.size}/{loanOptions.length}</span><br />
                      Est. loan expense: <span className="text-neo-text">{kFmt(includedLoanMonthlyEstimate)}/mo</span><br /><br />
                      Rent: <span className="text-neo-text">{kFmt(currentExpenseBreakdown.rentMonthly)}/mo</span><br />
                      Opex: <span className="text-neo-text">-{kFmt(currentExpenseBreakdown.opexMonthly)}/mo</span><br />
                      Loans: <span className="text-neo-text">-{kFmt(currentExpenseBreakdown.selectedLoanMonthlyToday)}/mo</span><br />
                      Net: <span className={currentExpenseBreakdown.netMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {currentExpenseBreakdown.netMonthly >= 0 ? '+' : ''}{kFmt(currentExpenseBreakdown.netMonthly)}/mo
                      </span>
                    </span>
                  </span>
                )}
              </span>
              <span className="text-[11px] text-neo-subtle mt-0.5">{c.sub}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
