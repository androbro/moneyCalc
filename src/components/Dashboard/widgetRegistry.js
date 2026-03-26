/**
 * widgetRegistry.js — central registry of all dashboard widgets.
 *
 * To add a new widget:
 *   1. Create a new file in widgets/ exporting `widgetConfig` and a default component
 *   2. Import them here and add an entry below
 *   3. That's it — the widget appears in DashboardGrid and DashboardSettingsPanel automatically
 *
 * @see DASHBOARD_WIDGETS.md for the full developer guide
 */

import { withWidgetWrapper } from './withWidgetWrapper'

import InvestmentReadyHeroWidget, { widgetConfig as heroConfig }     from './widgets/InvestmentReadyHeroWidget'
import KeyStatsWidget,             { widgetConfig as keyStatsConfig } from './widgets/KeyStatsWidget'
import ProjectionChartWidget,      { widgetConfig as chartConfig }    from './widgets/ProjectionChartWidget'
import EquityHeadroomWidget,       { widgetConfig as equityConfig }   from './widgets/EquityHeadroomWidget'
import CashFlowWidget,             { widgetConfig as cashFlowConfig } from './widgets/CashFlowWidget'
import PortfolioHealthWidget,      { widgetConfig as healthConfig }   from './widgets/PortfolioHealthWidget'
import AcquisitionPowerWidget,     { widgetConfig as powerConfig }    from './widgets/AcquisitionPowerWidget'
import GoalsWidget,                { widgetConfig as goalsConfig }    from './widgets/GoalsWidget'
import ProfileCardWidget,          { widgetConfig as profileConfig }  from './widgets/ProfileCardWidget'

/**
 * The registry: maps widget ID → { config, Component }
 * Component is already wrapped with withWidgetWrapper (drag handle + card chrome).
 *
 * @type {Object.<string, { config: import('./WidgetConfig').WidgetConfig, Component: React.ComponentType }>}
 */
export const WIDGET_REGISTRY = {
  [heroConfig.id]:     { config: heroConfig,     Component: withWidgetWrapper(InvestmentReadyHeroWidget, heroConfig) },
  [keyStatsConfig.id]: { config: keyStatsConfig, Component: withWidgetWrapper(KeyStatsWidget, keyStatsConfig) },
  [chartConfig.id]:    { config: chartConfig,    Component: withWidgetWrapper(ProjectionChartWidget, chartConfig) },
  [equityConfig.id]:   { config: equityConfig,   Component: withWidgetWrapper(EquityHeadroomWidget, equityConfig) },
  [cashFlowConfig.id]: { config: cashFlowConfig, Component: withWidgetWrapper(CashFlowWidget, cashFlowConfig) },
  [healthConfig.id]:   { config: healthConfig,   Component: withWidgetWrapper(PortfolioHealthWidget, healthConfig) },
  [powerConfig.id]:    { config: powerConfig,    Component: withWidgetWrapper(AcquisitionPowerWidget, powerConfig) },
  [goalsConfig.id]:    { config: goalsConfig,    Component: withWidgetWrapper(GoalsWidget, goalsConfig) },
  [profileConfig.id]:  { config: profileConfig,  Component: withWidgetWrapper(ProfileCardWidget, profileConfig) },
}

/**
 * Builds the default react-grid-layout layouts object from registry defaults.
 * Used to seed profile.dashboardLayout on first load.
 *
 * @returns {import('./interfaces').DashboardLayoutConfig}
 */
export function getDefaultLayouts() {
  const breakpoints = ['lg', 'md', 'sm', 'xs']
  const layouts = Object.fromEntries(breakpoints.map(bp => [bp, []]))

  Object.values(WIDGET_REGISTRY).forEach(({ config }) => {
    if (!config.defaultEnabled) return
    breakpoints.forEach((bp) => {
      const pos = config.defaultLayout[bp]
      if (!pos) return
      layouts[bp].push({ i: config.id, x: pos.x, y: pos.y, w: pos.w, h: pos.h, minW: config.minW, minH: config.minH })
    })
  })

  return { ...layouts, hidden: [] }
}

/**
 * Returns widget configs grouped by category, sorted alphabetically within each group.
 * Used by DashboardSettingsPanel to render the toggle list.
 *
 * @returns {Object.<string, import('./WidgetConfig').WidgetConfig[]>}
 */
export function getWidgetsByCategory() {
  const groups = {}
  Object.values(WIDGET_REGISTRY).forEach(({ config }) => {
    if (!groups[config.category]) groups[config.category] = []
    groups[config.category].push(config)
  })
  return groups
}
