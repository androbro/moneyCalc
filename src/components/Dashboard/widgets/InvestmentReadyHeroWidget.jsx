/**
 * InvestmentReadyHeroWidget — hero card showing total investment-ready capital.
 * Displays the 80% LTV equity + personal cash with a mobile-collapsible breakdown.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { WidgetConfig } from '../WidgetConfig'
import InvestmentReadyCard from '../components/InvestmentReadyCard'

export const widgetConfig = new WidgetConfig({
  id:             'investment_ready_hero',
  title:          'Investment Ready Capital',
  description:    'Total capital available for next acquisition: 80% LTV equity + personal cash',
  category:       'overview',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 0, y: 0, w: 8, h: 3 },
    md: { x: 0, y: 0, w: 8, h: 3 },
    sm: { x: 0, y: 0, w: 4, h: 4 },
    xs: { x: 0, y: 0, w: 4, h: 4 },
  },
  minW: 4,
  minH: 3,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function InvestmentReadyHeroWidget({ ctx }) {
  return (
    <InvestmentReadyCard
      total={ctx.investmentReadyCapital}
      equityPart={ctx.availableEquity}
      cashPart={ctx.liquidCash}
    />
  )
}
