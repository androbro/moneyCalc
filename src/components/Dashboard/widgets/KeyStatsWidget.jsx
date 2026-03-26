/**
 * KeyStatsWidget — 2×2 grid of KPI stat pills (Net Worth, Cash Flow, LTV, Properties).
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { motion } from 'motion/react'
import { WidgetConfig } from '../WidgetConfig'
import StatPill from '../components/StatPill'
import { formatEUR } from '../../../utils/projectionUtils'
import { SOFT_EASE } from '../utils/constants'
import { kFmt } from '../utils/formatters'

export const widgetConfig = new WidgetConfig({
  id:             'key_stats',
  title:          'Key Stats',
  description:    'Net Worth, Monthly Cash Flow, Portfolio LTV, and Property count at a glance',
  category:       'overview',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 0, y: 3, w: 8, h: 2 },
    md: { x: 0, y: 3, w: 8, h: 2 },
    sm: { x: 0, y: 4, w: 4, h: 4 },
    xs: { x: 0, y: 4, w: 4, h: 4 },
  },
  minW: 3,
  minH: 2,
})

function WalletIcon()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> }
function CashFlowIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function LTVIcon()      { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> }
function HomeIcon()     { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> }

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function KeyStatsWidget({ ctx }) {
  const { summary, ltv } = ctx

  const pills = [
    {
      icon: <WalletIcon />,
      label: 'Net Worth',
      value: formatEUR(summary.personalNetWorth),
      explanation: (
        <>
          <p>Personal net worth includes your share of real-estate equity, plus liquid cash and trading portfolio value.</p>
          <p className="mt-1.5 font-mono text-[10px] text-neo-icon">
            {kFmt(summary.personalRealEstateNetWorth)} + {kFmt(summary.personalCash)} + {kFmt(summary.personalTradingValue)}
          </p>
        </>
      ),
    },
    {
      icon: <CashFlowIcon />,
      label: 'Monthly CF',
      value: formatEUR(summary.totalMonthlyCashFlow),
      explanation: (
        <>
          <p>Monthly cash flow is rent minus operating costs and interest (capital repayment is tracked separately).</p>
          <p className="mt-1.5 font-mono text-[10px] text-neo-icon">
            {kFmt(summary.annualRentalIncome / 12)} - {kFmt(summary.annualOpex / 12)} - {kFmt(summary.monthlyInterest)}
          </p>
        </>
      ),
    },
    {
      icon: <LTVIcon />,
      label: 'Portfolio LTV',
      value: ltv !== null ? `${ltv.toFixed(1)}%` : '—',
      explanation: (
        <>
          <p>Loan-to-value compares total outstanding debt to total portfolio value across live properties.</p>
          <p className="mt-1.5 font-mono text-[10px] text-neo-icon">
            ({kFmt(summary.totalDebt)} / {kFmt(summary.totalPortfolioValue)}) x 100
          </p>
        </>
      ),
    },
    {
      icon: <HomeIcon />,
      label: 'Properties',
      value: summary.propertyCount,
      explanation: 'Count of live properties currently in portfolio metrics (planned entries are excluded).',
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 h-full"
      initial="initial"
      animate="animate"
      variants={{ initial: {}, animate: { transition: { staggerChildren: 0.05 } } }}
    >
      {pills.map((pill) => (
        <motion.div
          key={pill.label}
          variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: SOFT_EASE } } }}
        >
          <StatPill {...pill} />
        </motion.div>
      ))}
    </motion.div>
  )
}
