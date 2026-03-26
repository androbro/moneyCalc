/**
 * Shared animation constants and configuration values for the Dashboard.
 * Import from here instead of re-declaring inline.
 */

export const SOFT_EASE = [0.22, 1, 0.36, 1]

export const cardReveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: SOFT_EASE },
}

/** Belgian 80% LTV cap — max you can borrow against a property */
export const LTV_MAX = 0.80

/** Chart catalogue used by the projection chart widget */
export const CHARTS = [
  { id: 'net_worth',        label: 'Net Worth',               sub: 'Appreciation − debt paydown'     },
  { id: 'investment_ready', label: 'Investment Ready Capital', sub: '80% LTV headroom + cash'         },
  { id: 'cashflow',         label: 'Monthly Cash Flow',        sub: 'Rent − expenses − loan payments' },
]
