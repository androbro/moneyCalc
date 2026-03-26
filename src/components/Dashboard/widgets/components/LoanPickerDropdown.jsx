/**
 * LoanPickerDropdown — dropdown to toggle which loans are included in the cash flow chart.
 */

import { AnimatePresence, motion } from 'motion/react'
import { kFmt } from '../../utils/formatters'
import { SOFT_EASE } from '../../utils/constants'

/**
 * @param {{
 *   open: boolean,
 *   loanOptions: Array,
 *   includedLoanKeys: Set,
 *   onToggle: (loanKey: string) => void,
 *   onSelectAll: () => void,
 *   onSelectNone: () => void,
 * }} props
 */
export default function LoanPickerDropdown({ open, loanOptions, includedLoanKeys, onToggle, onSelectAll, onSelectNone }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute right-0 top-14 z-20 rounded-2xl border border-white/[0.10] p-3 shadow-2xl"
          style={{ background: 'rgba(8,12,22,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', minWidth: '280px', maxWidth: '340px' }}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: SOFT_EASE }}
        >
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-xs font-semibold text-neo-text">Loans included in cash flow</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onSelectAll} className="text-[10px] text-neo-subtle hover:text-neo-muted">All</button>
              <button type="button" onClick={onSelectNone} className="text-[10px] text-neo-subtle hover:text-neo-muted">None</button>
            </div>
          </div>

          <div className="max-h-52 overflow-auto space-y-1 pr-1">
            {loanOptions.map((loan) => {
              const included = includedLoanKeys.has(loan.key)
              return (
                <label key={loan.key} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05] cursor-pointer">
                  <input type="checkbox" checked={included} onChange={() => onToggle(loan.key)} className="mt-0.5 accent-brand-500" />
                  <span className="min-w-0">
                    <span className="block text-xs text-neo-text truncate">
                      {loan.propertyLabel} · {loan.loanLabel}
                    </span>
                    <span className="block text-[10px] text-neo-subtle tabular-nums">
                      {kFmt(loan.monthlyPayment)}/mo{loan.startDate ? ` · ${loan.startDate}` : ''}
                      {loan.termMonths > 0 ? ` · ${loan.termMonths}mo` : ''}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
