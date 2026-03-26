/**
 * AcquisitionPowerWidget — estimated max property price at 20% and 10% down payment.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { WidgetConfig } from '../WidgetConfig'
import { kFmt } from '../utils/formatters'

export const widgetConfig = new WidgetConfig({
  id:             'acquisition_power',
  title:          'Acquisition Power',
  description:    'Max property value at 20% (conservative) and 10% (leveraged) down payment',
  category:       'planning',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 8, y: 5, w: 4, h: 4 },
    md: { x: 4, y: 22, w: 4, h: 4 },
    sm: { x: 0, y: 30, w: 4, h: 4 },
    xs: { x: 0, y: 30, w: 4, h: 4 },
  },
  minW: 3,
  minH: 3,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function AcquisitionPowerWidget({ ctx }) {
  const { investmentReadyCapital, buyPowerConservative, buyPowerLeveraged } = ctx

  return (
    <div>
      <p className="text-xs text-neo-subtle mb-4">Based on {kFmt(investmentReadyCapital)} ready capital</p>
      <div className="space-y-3">
        <div className="rounded-2xl px-3 py-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Conservative · 20% down</p>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{kFmt(buyPowerConservative)}</p>
          <p className="text-[10px] text-neo-subtle mt-0.5">max property value</p>
        </div>
        <div className="rounded-2xl px-3 py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1">Leveraged · 10% down</p>
          <p className="text-lg font-bold text-amber-400 tabular-nums">{kFmt(buyPowerLeveraged)}</p>
          <p className="text-[10px] text-neo-subtle mt-0.5">max property value</p>
        </div>
      </div>
    </div>
  )
}
