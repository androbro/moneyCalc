# Dashboard Widget Developer Guide

This document explains how to add a new datapoint or widget to the MoneyCalc dashboard.
It is written for AI assistants (Claude) and human developers alike.

---

## Architecture Overview

The dashboard uses a **Widget Registry** pattern:

```
Dashboard.jsx          ← computes DashboardContext, holds modal state
  └── DashboardGrid.jsx          ← react-grid-layout renderer
        └── [Widget].jsx         ← self-contained widget components
              └── widgetRegistry.js ← maps id → { config, Component }
```

Every widget:
1. Lives in `src/components/Dashboard/widgets/`
2. Exports a `widgetConfig` (instance of `WidgetConfig`)
3. Exports a default React component that receives `{ ctx }` as its only prop
4. Is registered in `widgetRegistry.js` — **no other files need to change**

---

## Step-by-Step: Adding a New Widget

### 1. Create the widget file

Create `src/components/Dashboard/widgets/MyNewWidget.jsx`:

```jsx
import { WidgetConfig } from '../WidgetConfig'
import { kFmt } from '../utils/formatters'

// Required export #1: metadata
export const widgetConfig = new WidgetConfig({
  id:             'my_new_widget',           // unique snake_case ID
  title:          'My New Widget',           // shown in settings panel header
  description:    'What this widget shows',  // shown in settings panel description
  category:       'overview',               // 'overview' | 'cashflow' | 'planning' | 'personal'
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 0, y: 20, w: 4, h: 4 },       // 12-col grid, rowHeight=60px
    md: { x: 0, y: 20, w: 4, h: 4 },       // 8-col grid
    sm: { x: 0, y: 20, w: 4, h: 4 },       // 4-col grid (mobile)
    xs: { x: 0, y: 20, w: 4, h: 4 },
  },
  minW: 2,    // minimum resize width in grid columns
  minH: 2,    // minimum resize height in grid rows
})

// Required export #2: the component
/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function MyNewWidget({ ctx }) {
  // Use ctx to access all portfolio data — see DashboardContext in interfaces.js
  const { summary, properties } = ctx

  return (
    <div>
      <p className="text-sm text-neo-muted">My value</p>
      <p className="text-xl font-bold text-neo-text">{kFmt(summary.totalNetWorth)}</p>
    </div>
  )
}
```

### 2. Register the widget

Add two lines to `src/components/Dashboard/widgetRegistry.js`:

```js
// At the top with other imports:
import MyNewWidget, { widgetConfig as myNewConfig } from './widgets/MyNewWidget'

// In the WIDGET_REGISTRY object:
[myNewConfig.id]: { config: myNewConfig, Component: withWidgetWrapper(MyNewWidget, myNewConfig) },
```

That's it. The widget will now:
- Appear in the grid at its `defaultLayout` position
- Show up in the settings panel (gear icon) with toggle and description
- Be draggable and resizable on desktop
- Stack vertically on mobile

---

## DashboardContext Reference

Every widget receives `ctx` with the following fields:

### Raw Portfolio Data
| Field | Type | Description |
|-------|------|-------------|
| `properties` | `Array` | All property objects (see data model docs) |
| `profile` | `Object` | Household profile (members, goals, dashboardLayout) |
| `tradingPortfolioValue` | `number` | Current stock trading portfolio value in EUR |

### Computed Summary (from `computeSummary()`)
| Field | Type | Description |
|-------|------|-------------|
| `summary.totalPortfolioValue` | `number` | Total property value across all owners |
| `summary.totalDebt` | `number` | Total outstanding loan balances |
| `summary.totalNetWorth` | `number` | totalPortfolioValue − totalDebt |
| `summary.personalNetWorth` | `number` | Your share: RE equity + cash + trading |
| `summary.personalRealEstateNetWorth` | `number` | Your share of RE equity |
| `summary.personalCash` | `number` | Liquid cash from profile |
| `summary.personalTradingValue` | `number` | Trading portfolio value |
| `summary.totalMonthlyCashFlow` | `number` | Rent − opex − interest per month |
| `summary.annualRentalIncome` | `number` | Annual gross rental income |
| `summary.annualOpex` | `number` | Annual operating expenses |
| `summary.monthlyInterest` | `number` | Monthly interest portion of loan payments |
| `summary.monthlyCapital` | `number` | Monthly capital repayment portion |
| `summary.roe` | `number` | Return on Equity % |
| `summary.propertyCount` | `number` | Live (non-planned) properties |
| `summary.activeRentalCount` | `number` | Currently rented properties |

### Derived Portfolio Metrics
| Field | Type | Description |
|-------|------|-------------|
| `ltv` | `number\|null` | Portfolio LTV %, null if no properties |
| `healthScore` | `number` | 0–100 composite health score |
| `investmentReadyCapital` | `number` | Equity headroom + liquid cash |
| `availableEquity` | `number` | 80% LTV equity across all properties |
| `liquidCash` | `number` | Personal cash from profile |
| `buyPowerConservative` | `number` | investmentReadyCapital × 5 (20% down) |
| `buyPowerLeveraged` | `number` | investmentReadyCapital × 10 (10% down) |
| `propertyEquityRows` | `Array` | `[{ name, value, debt, headroom, ltvPct }]` sorted by headroom |
| `projectedInvestmentReadyByYear` | `Map<number,number>` | year → projected investment-ready capital |

### Goals
| Field | Type | Description |
|-------|------|-------------|
| `capitalGoals` | `Array` | `[{ id, targetYear, targetAmount, createdAt }]` |
| `onOpenGoalModal` | `Function` | `(goalToEdit\|null) => void` — opens goal modal |
| `onDeleteGoal` | `Function` | `(goalId: string) => void` |

### Actions & Profile
| Field | Type | Description |
|-------|------|-------------|
| `onSaveProfile` | `Function` | `(updatedProfile) => Promise<void>` — persists to Supabase/localStorage |
| `onAddProperty` | `Function` | `() => void` — opens property form |
| `profileName` | `string` | Display name of "me" household member |
| `profileInitials` | `string` | First 2 chars of profileName, uppercased |

---

## Available Utility Functions

Import from utils/ — never re-implement in widgets:

```js
import { kFmt, healthLabel }          from '../utils/formatters'
import { computeHealthScore }          from '../utils/healthScore'
import { getLoanKey }                  from '../utils/loanUtils'
import { SOFT_EASE, cardReveal, CHARTS, LTV_MAX } from '../utils/constants'
import {
  generateNetWorthProjection,
  generateInvestmentReadyProjection,
  generateCashFlowProjection,
} from '../utils/chartGenerators'
```

## Reusable UI Components

```js
import GlowCard          from '../components/GlowCard'         // interactive glow card
import StatPill          from '../components/StatPill'         // KPI stat with tooltip
import ChartTooltip      from '../components/ChartTooltip'     // recharts tooltip
import GoalBar           from '../components/GoalBar'          // animated progress bar
import RadialGauge       from '../components/RadialGauge'      // SVG arc gauge
import PropertyEquityRow from '../components/PropertyEquityRow' // per-property LTV row
```

---

## Widget Config Options

```js
new WidgetConfig({
  id:             'snake_case_id',     // required, unique
  title:          'Display Name',      // required
  description:    'One line description', // required
  category:       'overview',          // required: 'overview'|'cashflow'|'planning'|'personal'
  defaultEnabled: true,                // optional, defaults to true
  defaultLayout: {                     // required
    lg: { x, y, w, h },  // lg ≥1200px, 12 cols, rowHeight=60px
    md: { x, y, w, h },  // md ≥996px,  8 cols
    sm: { x, y, w, h },  // sm ≥768px,  4 cols
    xs: { x, y, w, h },  // xs <768px,  4 cols
  },
  minW: 2,     // optional, minimum width in grid cols
  minH: 2,     // optional, minimum height in grid rows
})
```

### ChartWidgetConfig (for widgets with chart type switcher)
```js
import { ChartWidgetConfig } from '../WidgetConfig'

export const widgetConfig = new ChartWidgetConfig({
  ...baseOptions,
  chartTypes: [{ id: 'line', label: 'Line Chart', sub: 'desc' }],
})
```

---

## Sizing Guidelines

With `rowHeight = 60px`:
- `h: 2` = 120px + margins (good for: stat row, mini card)
- `h: 3` = 180px (good for: hero card, small list)
- `h: 4` = 240px (good for: medium card with details)
- `h: 5` = 300px (good for: list or breakdown table)
- `h: 6` = 360px (good for: chart, tall list)

Column widths on lg (12 cols, full width ~1400px):
- `w: 4` ≈ 450px (narrow panel)
- `w: 5` ≈ 560px (half-ish)
- `w: 8` ≈ 900px (main content)
- `w: 12` = full width

---

## File Size Rule

**No file may exceed 300 lines.** If a widget grows beyond this:
1. Extract sub-components to `widgets/components/MySubComponent.jsx`
2. Extract pure logic to `utils/myLogic.js`
3. See `ProjectionChartWidget.jsx` + `widgets/components/ChartPickerDropdown.jsx` as an example
