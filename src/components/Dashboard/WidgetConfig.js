/**
 * WidgetConfig — base class for dashboard widget metadata.
 *
 * Every widget must instantiate this class (or a subclass) and export it
 * as `widgetConfig`. The registry reads these to build the settings panel
 * and default grid layouts.
 *
 * Subclass when a widget type has extra shared metadata (e.g. chart-type widgets).
 *
 * @see interfaces.js for the full WidgetDefaultLayout typedef
 * @see DASHBOARD_WIDGETS.md for the developer guide
 */
export class WidgetConfig {
  /**
   * @param {Object} options
   * @param {string} options.id               - Unique snake_case identifier, e.g. 'cash_flow'
   * @param {string} options.title            - Display name shown in settings panel
   * @param {string} options.description      - Short description shown in settings panel
   * @param {'overview'|'cashflow'|'planning'|'personal'} options.category
   * @param {boolean}  [options.defaultEnabled=true]
   * @param {import('./interfaces').WidgetDefaultLayout} options.defaultLayout
   * @param {number}   [options.minW=3]        - Minimum grid column span
   * @param {number}   [options.minH=2]        - Minimum grid row span
   */
  constructor({ id, title, description, category, defaultEnabled, defaultLayout, minW, minH }) {
    this.id             = id
    this.title          = title
    this.description    = description
    this.category       = category
    this.defaultEnabled = defaultEnabled ?? true
    this.defaultLayout  = defaultLayout
    this.minW           = minW ?? 3
    this.minH           = minH ?? 2
  }
}

/**
 * ChartWidgetConfig — extends WidgetConfig for widgets that offer
 * multiple chart types the user can switch between.
 */
export class ChartWidgetConfig extends WidgetConfig {
  /**
   * @param {Object}   options
   * @param {Array<{id: string, label: string, sub: string}>} options.chartTypes
   */
  constructor(options) {
    super(options)
    /** @type {Array<{id: string, label: string, sub: string}>} */
    this.chartTypes = options.chartTypes ?? []
  }
}
