/**
 * CashFlowWidget — monthly cash flow breakdown (income, interest, opex, net, ROE).
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { WidgetConfig } from '../WidgetConfig'
import { kFmt } from '../utils/formatters'
import { formatEUR } from '../../../utils/projectionUtils'

export const widgetConfig = new WidgetConfig({
  id:             'cash_flow',
  title:          'Cash Flow',
  description:    'Monthly rental income minus interest and operating costs, plus ROE',
  category:       'cashflow',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 0, y: 11, w: 8, h: 5 },
    md: { x: 0, y: 11, w: 8, h: 5 },
    sm: { x: 0, y: 20, w: 4, h: 5 },
    xs: { x: 0, y: 20, w: 4, h: 5 },
  },
  minW: 3,
  minH: 4,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function CashFlowWidget({ ctx }) {
  const { summary } = ctx

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
        <span className="text-sm text-neo-muted">Rental income</span>
        <span className="text-sm font-semibold text-emerald-400 tabular-nums">+{kFmt(summary.annualRentalIncome / 12)}/mo</span>
      </div>
      <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
        <span className="text-sm text-neo-muted">Interest costs</span>
        <span className="text-sm font-semibold text-red-400 tabular-nums">-{kFmt(summary.monthlyInterest)}/mo</span>
      </div>
      <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
        <span className="text-sm text-neo-muted">Operating costs</span>
        <span className="text-sm font-semibold text-red-400 tabular-nums">-{kFmt(summary.annualOpex / 12)}/mo</span>
      </div>
      <div className="flex justify-between items-center py-2">
        <span className="text-sm font-medium text-neo-text">Net monthly CF</span>
        <span className={`text-sm font-bold tabular-nums ${summary.totalMonthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {summary.totalMonthlyCashFlow >= 0 ? '+' : ''}{formatEUR(summary.totalMonthlyCashFlow)}/mo
        </span>
      </div>
      <div className="flex justify-between items-center pt-1">
        <span className="text-xs text-neo-muted">Capital repaid/mo</span>
        <span className="text-xs font-semibold text-neo-muted tabular-nums">+{kFmt(summary.monthlyCapital)}/mo</span>
      </div>
      {summary.roe > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-neo-muted">Return on Equity (ROE)</span>
          <span className="text-xs font-semibold text-emerald-400 tabular-nums">{summary.roe.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}
