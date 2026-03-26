/**
 * PortfolioHealthWidget — radial health gauge with portfolio value, LTV, debt and net worth.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { WidgetConfig } from '../WidgetConfig'
import RadialGauge from '../components/RadialGauge'
import { kFmt, healthLabel } from '../utils/formatters'

export const widgetConfig = new WidgetConfig({
  id:             'portfolio_health',
  title:          'Portfolio Health',
  description:    'Composite health score based on LTV, cash flow and diversification',
  category:       'overview',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 8, y: 0, w: 4, h: 5 },
    md: { x: 0, y: 22, w: 4, h: 5 },
    sm: { x: 0, y: 25, w: 4, h: 5 },
    xs: { x: 0, y: 25, w: 4, h: 5 },
  },
  minW: 3,
  minH: 4,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function PortfolioHealthWidget({ ctx }) {
  const { summary, ltv, healthScore } = ctx

  return (
    <div className="flex items-center gap-4">
      <RadialGauge pct={healthScore} label={healthLabel(healthScore)} />
      <div className="flex-1 space-y-2.5">
        <div className="flex justify-between">
          <span className="text-xs text-neo-muted">Portfolio value</span>
          <span className="text-xs font-medium text-neo-text tabular-nums">{kFmt(summary.totalPortfolioValue)}</span>
        </div>
        {ltv !== null && (
          <div className="flex justify-between">
            <span className="text-xs text-neo-muted">LTV</span>
            <span className={`text-xs font-semibold tabular-nums ${ltv < 60 ? 'text-emerald-400' : ltv < 80 ? 'text-amber-400' : 'text-red-400'}`}>
              {ltv.toFixed(1)}%
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-xs text-neo-muted">Total debt</span>
          <span className="text-xs font-medium text-red-400 tabular-nums">{kFmt(summary.totalDebt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-neo-muted">Net worth</span>
          <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(summary.personalNetWorth)}</span>
        </div>
      </div>
    </div>
  )
}
