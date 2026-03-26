# MoneyCalc — AI Context File

This file provides context for AI assistants (Claude) working on this codebase.
It is read automatically at the start of every Claude Code session.

---

## Project Overview

**MoneyCalc** is a Belgian real-estate portfolio tracker. It helps investors:
- Track property values, loans, and rental income
- Compute net worth, LTV, cash flow, and ROE
- Plan future acquisitions using 80% LTV equity headroom
- Simulate scenarios (hold vs. sell, new acquisitions)
- Track household goals and trading portfolios

**Tech Stack:** React 18 + Vite, Tailwind CSS, Recharts, Supabase (PostgreSQL + Auth), react-grid-layout

---

## Code Style Rules (enforced in all files)

1. **Max 300 lines per file** — if a file approaches this limit, split it:
   - Extract React sub-components to a `components/` subfolder
   - Extract pure functions to a `utils/` subfolder
   - Extract widget sub-components to `widgets/components/`

2. **SOLID principles**:
   - **S** — One file, one responsibility (e.g. `healthScore.js` only scores health)
   - **O** — Add features by adding files, not modifying existing ones (especially the widget registry)
   - **L** — Subclasses (`ChartWidgetConfig extends WidgetConfig`) must honour base class contracts
   - **I** — Widgets only depend on the `DashboardContext` interface, not Dashboard internals
   - **D** — High-level modules (Dashboard.jsx) depend on abstractions (context interface), not concrete widgets

3. **Classes for configuration objects** — use `WidgetConfig` / `ChartWidgetConfig` classes for
   registry metadata. Never use plain objects for configs that may need to be extended.

4. **HOC pattern for component composition** — use `withWidgetWrapper` (or build similar HOCs)
   instead of duplicating wrapper chrome in every component.

5. **JSDoc interfaces** — all cross-component data shapes must be documented in an `interfaces.js`
   file in the relevant directory. Every widget's `ctx` prop must reference `DashboardContext`.

6. **No business logic in JSX** — extract to `utils/` or `calculations/` modules.
   JSX files should only describe structure and delegate to pure functions.

7. **No React in `utils/`** — utility files must be pure JS functions only (importable in tests).

---

## Key Directories

```
src/
  app/AppShell.jsx           ← main state container (portfolio, profile, trades)
  components/Dashboard/      ← dashboard widget system (see below)
  components/               ← other page components (Properties, Projection, etc.)
  calculations/             ← pure business logic (loans, taxes, projections, scenarios)
  lib/                      ← auth, storage (guest/Supabase), mock data
  services/portfolio/       ← Supabase data layer (mirrors guestStorage.js API)
  hooks/                    ← useLocalStorage, useMediaQuery
  utils/projectionUtils.js  ← re-export hub for calculation modules
```

---

## Dashboard Widget System

### How to add a new datapoint to the dashboard

See the full guide: `src/components/Dashboard/DASHBOARD_WIDGETS.md`

**Short version:**
1. Create `src/components/Dashboard/widgets/MyWidget.jsx` — export `widgetConfig` + default component
2. Add one entry to `src/components/Dashboard/widgetRegistry.js`
3. Done — widget appears in grid and settings panel automatically

### Key dashboard files
| File | Purpose |
|------|---------|
| `Dashboard.jsx` | Computes `DashboardContext`, holds modal state, ~200 lines |
| `DashboardGrid.jsx` | react-grid-layout renderer, reads/saves layout from profile |
| `DashboardSettingsPanel.jsx` | Gear-icon slide-in panel, toggle/reset widgets |
| `widgetRegistry.js` | Central `{ id → { config, Component } }` map |
| `WidgetConfig.js` | `WidgetConfig` base class + `ChartWidgetConfig` subclass |
| `withWidgetWrapper.jsx` | HOC: drag handle + GlowCard chrome for every widget |
| `interfaces.js` | JSDoc typedefs: `DashboardContext`, layout shapes |
| `DASHBOARD_WIDGETS.md` | Full developer guide for adding widgets |
| `utils/` | Pure functions: formatters, constants, chartGenerators, healthScore, loanUtils |
| `components/` | Reusable UI atoms: GlowCard, StatPill, RadialGauge, etc. |
| `widgets/` | One file per widget |

### DashboardContext — data available to every widget
All widgets receive `{ ctx }` prop with:
- `properties`, `profile`, `tradingPortfolioValue`
- `summary` — all 27 computeSummary() fields
- `ltv`, `healthScore`, `investmentReadyCapital`, `availableEquity`, `liquidCash`
- `buyPowerConservative`, `buyPowerLeveraged`
- `propertyEquityRows`, `projectedInvestmentReadyByYear`
- `capitalGoals`, `onOpenGoalModal`, `onDeleteGoal`
- `onSaveProfile`, `onAddProperty`
- `profileName`, `profileInitials`

---

## Data Architecture (Dual Storage)

The app works for both guests and authenticated users using the **same API surface**:

| Layer | Guest | Authenticated |
|-------|-------|---------------|
| Storage | `localStorage` | Supabase PostgreSQL |
| Service | `src/lib/guestStorage.js` | `src/services/portfolio/portfolioService.js` |
| Switching | `AppShell.jsx` → `isLoggedIn` from `AuthContext` | same |

Both files export identical async function signatures. Never import one directly in
components — always receive data via props from `AppShell.jsx`.

---

## Calculation Modules

All in `src/calculations/` — pure functions, no React, no side effects:

- `loans/` — amortization, remaining balance, payment splits
- `taxes/` — Belgian rental tax (30%), capital gains (16.5%), registration tax (12%/2%)
- `projections/` — 20-year portfolio projection, `computeSummary()` (27 fields)
- `scenarios/` — hold vs. sell analysis, acquisition simulation
- `growth/` — growth planning algorithms

Import via `src/utils/projectionUtils.js` (re-export hub for backwards compatibility).

---

## Property Data Model (summary)

```js
{
  id, name, address, purchasePrice, currentValue, appreciationRate,
  status: 'rented' | 'primary_residence' | 'planned' | 'sold',
  isRented, rentalStartDate, rentalEndDate,
  owners: [{ name, share }],
  startRentalIncome, indexationRate, monthlyExpenses, vacancyRate,
  annualMaintenanceCost, annualInsuranceCost, annualPropertyTax,
  loans: [{ id, lender, originalAmount, interestRate, startDate, termMonths, monthlyPayment, amortizationSchedule }],
  plannedInvestments: [...]
}
```

---

## Conventions

- **Dates:** ISO 8601 strings throughout JS; snake_case columns in DB
- **Currency:** EUR only, formatted with `kFmt()` (compact) or `formatEUR()` (full)
- **IDs:** UUIDs via `import { v4 as uuidv4 } from 'uuid'`
- **Animations:** `motion/react` (framer-motion fork); use `SOFT_EASE` and `cardReveal` from `utils/constants.js`
- **Styling:** Tailwind + custom `neo-*` design tokens (dark glass morphism, orange brand accent)
