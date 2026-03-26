/**
 * ProfileCardWidget — summary card for the "me" household member.
 * Shows name, property count, liquid cash, equity headroom, and trading value.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { WidgetConfig } from '../WidgetConfig'
import { kFmt } from '../utils/formatters'

export const widgetConfig = new WidgetConfig({
  id:             'profile_card',
  title:          'Profile',
  description:    'Personal summary: cash, equity, trading portfolio',
  category:       'personal',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 8, y: 15, w: 4, h: 4 },
    md: { x: 0, y: 34, w: 4, h: 4 },
    sm: { x: 0, y: 39, w: 4, h: 4 },
    xs: { x: 0, y: 39, w: 4, h: 4 },
  },
  minW: 3,
  minH: 3,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function ProfileCardWidget({ ctx }) {
  const { summary, liquidCash, availableEquity, profileName, profileInitials } = ctx

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-brand-600/15 border border-brand-500/20
                        flex items-center justify-center text-brand-400 font-bold shrink-0">
          {profileInitials}
        </div>
        <div>
          <p className="font-semibold text-neo-text text-sm leading-snug">{profileName}</p>
          <p className="text-xs text-neo-muted">
            {summary.propertyCount} propert{summary.propertyCount === 1 ? 'y' : 'ies'} · {summary.activeRentalCount} rented
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-xs text-neo-muted">Liquid cash</span>
          <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(liquidCash)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-neo-muted">Equity headroom</span>
          <span className="text-xs font-semibold text-brand-400 tabular-nums">{kFmt(availableEquity)}</span>
        </div>
        {summary.personalTradingValue > 0 && (
          <div className="flex justify-between">
            <span className="text-xs text-neo-muted">Trading portfolio</span>
            <span className="text-xs font-semibold text-neo-text tabular-nums">{kFmt(summary.personalTradingValue)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
