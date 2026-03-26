/**
 * @fileoverview JSDoc interface definitions for the Dashboard widget system.
 *
 * These typedefs serve as the "contracts" between the Dashboard's data layer
 * and every widget component. When adding a new widget, it should only depend
 * on fields from DashboardContext — never import directly from Dashboard.jsx.
 *
 * @see DASHBOARD_WIDGETS.md for the full developer guide.
 */

/**
 * The complete context object passed as the `ctx` prop to every widget component.
 * All fields are read-only from the widget's perspective.
 *
 * @typedef {Object} DashboardContext
 *
 * — Raw portfolio data —
 * @property {Array<Object>}  properties            - All property objects
 * @property {Object}         profile               - Household profile (members, goals, dashboardLayout)
 * @property {number}         tradingPortfolioValue - Current trading portfolio value in EUR
 *
 * — Computed summary (from computeSummary) —
 * @property {Object}         summary               - Full computeSummary() output (27 fields)
 * @property {number|null}    ltv                   - Portfolio LTV % (null if no properties)
 * @property {number}         healthScore           - 0–100 health score
 *
 * — Investment Ready Capital —
 * @property {number}         investmentReadyCapital      - Equity headroom + personal cash
 * @property {number}         availableEquity             - 80% LTV equity across all properties
 * @property {number}         liquidCash                  - Personal cash from profile
 * @property {number}         buyPowerConservative        - investmentReadyCapital × 5 (20% down)
 * @property {number}         buyPowerLeveraged           - investmentReadyCapital × 10 (10% down)
 * @property {Array<Object>}  propertyEquityRows          - Per-property equity breakdown, sorted by headroom
 * @property {Map<number,number>} projectedInvestmentReadyByYear - year → projected investment-ready capital
 *
 * — Goals —
 * @property {Array<Object>}  capitalGoals          - Array of { id, targetYear, targetAmount, createdAt }
 * @property {Function}       onOpenGoalModal       - (goalToEdit: Object|null) => void
 * @property {Function}       onDeleteGoal          - (goalId: string) => void
 *
 * — Actions —
 * @property {Function}       onSaveProfile         - (updatedProfile: Object) => Promise<void>
 * @property {Function}       onAddProperty         - () => void
 *
 * — Profile display —
 * @property {string}         profileName           - Display name of the "me" household member
 * @property {string}         profileInitials       - First two characters of profileName, uppercased
 */

/**
 * Shape of the `defaultLayout` field on every WidgetConfig instance.
 * One entry per react-grid-layout breakpoint.
 *
 * @typedef {Object} WidgetBreakpointLayout
 * @property {number} x - Column start (0-based)
 * @property {number} y - Row start (0-based)
 * @property {number} w - Width in grid columns
 * @property {number} h - Height in grid rows (1 row = 60px by default)
 */

/**
 * Full default layout map across all breakpoints.
 *
 * @typedef {Object} WidgetDefaultLayout
 * @property {WidgetBreakpointLayout} lg  - ≥1200px  (12 cols)
 * @property {WidgetBreakpointLayout} md  - ≥996px   (8 cols)
 * @property {WidgetBreakpointLayout} sm  - ≥768px   (4 cols)
 * @property {WidgetBreakpointLayout} xs  - <768px   (4 cols)
 */

/**
 * The serializable layout stored in profile.dashboardLayout.
 * Matches the format consumed by react-grid-layout's `layouts` prop.
 *
 * @typedef {Object} DashboardLayoutConfig
 * @property {Array<Object>} lg       - react-grid-layout items for lg breakpoint
 * @property {Array<Object>} md       - react-grid-layout items for md breakpoint
 * @property {Array<Object>} sm       - react-grid-layout items for sm breakpoint
 * @property {Array<Object>} xs       - react-grid-layout items for xs breakpoint
 * @property {Array<string>} hidden   - IDs of widgets that are currently disabled
 */
