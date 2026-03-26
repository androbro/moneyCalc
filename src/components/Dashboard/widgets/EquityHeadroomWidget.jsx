/**
 * EquityHeadroomWidget — per-property 80% LTV equity headroom breakdown.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { WidgetConfig } from '../WidgetConfig'
import PropertyEquityRow from '../components/PropertyEquityRow'
import { kFmt } from '../utils/formatters'

export const widgetConfig = new WidgetConfig({
  id:             'equity_headroom',
  title:          'Equity Headroom',
  description:    'Available borrowing at 80% LTV broken down per property',
  category:       'overview',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 5, y: 5, w: 3, h: 6 },
    md: { x: 4, y: 5, w: 4, h: 6 },
    sm: { x: 0, y: 14, w: 4, h: 6 },
    xs: { x: 0, y: 14, w: 4, h: 6 },
  },
  minW: 3,
  minH: 4,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function EquityHeadroomWidget({ ctx }) {
  const { propertyEquityRows, availableEquity } = ctx

  return (
    <div>
      <p className="text-xs text-neo-subtle mb-4">Available borrowing at 80% LTV per property</p>

      {propertyEquityRows.length > 0 ? (
        <div>
          {propertyEquityRows.map((row, i) => (
            <PropertyEquityRow key={i} {...row} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-neo-subtle text-center py-8">No live properties</p>
      )}

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center">
        <span className="text-xs text-neo-muted">Total available equity</span>
        <span className="text-sm font-bold text-brand-400 tabular-nums">{kFmt(availableEquity)}</span>
      </div>
    </div>
  )
}
