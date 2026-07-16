# Property Features — Full Implementation Spec

**Purpose:** Complete, self-contained specification of all real-estate property functionality in moneyCalc, written so an AI agent can rebuild it inside another project (Adapt Tracker) without access to this codebase. Covers all 48 features from `PROPERTY_FEATURES.md`: data model, every formula, every algorithm, defaults, Belgian tax rules, and UI behaviors.

**Source app:** React 18 + Supabase (Postgres), Recharts for charts, EUR currency, `nl-BE` locale for all number/date formatting.

---

## Table of contents

1. [Conventions & global defaults](#1-conventions--global-defaults)
2. [Data model](#2-data-model)
3. [Core utilities](#3-core-utilities)
4. [Loan mathematics](#4-loan-mathematics)
5. [Belgian tax modules](#5-belgian-tax-modules)
6. [20-year projection engine](#6-20-year-projection-engine-buildprojection)
7. [Portfolio summary / dashboard KPIs](#7-portfolio-summary-computesummary)
8. [Dashboard features](#8-dashboard-features)
9. [Property form (data entry)](#9-property-form-data-entry)
10. [Property detail page](#10-property-detail-page)
11. [Property timeline](#11-property-timeline)
12. [Money Flow & Cash Flow Aggregator](#12-money-flow--cash-flow-aggregator)
13. [Projection page](#13-projection-page)
14. [Scenario Planner (keep / sell / occupy)](#14-scenario-planner-keep--sell--occupy)
15. [Sale proceeds engine](#15-sale-proceeds-engine)
16. [Property Simulator (future acquisition)](#16-property-simulator-future-acquisition)
17. [Growth Planner (snowball roadmap)](#17-growth-planner-snowball-roadmap)
18. [Belgian loan-type catalog](#18-belgian-loan-type-catalog)
19. [Acceleration advice engine](#19-acceleration-advice-engine)
20. [Household profile](#20-household-profile)
21. [Sharing, guest mode, AI insights](#21-sharing-guest-mode-ai-insights)
22. [Known quirks & porting decisions](#22-known-quirks--porting-decisions)

---

## 1. Conventions & global defaults

- **Currency:** EUR. Format with `Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })`. Large chart axis values abbreviated: ≥1M → `€x.xM`, ≥1k → `€xk`.
- **Dates:** stored ISO (`YYYY-MM-DD`); displayed via `nl-BE` locale.
- **Rates:** stored as fractions (0.02 = 2%), entered in the UI as whole percentages.
- **Rounding:** monetary outputs rounded to whole EUR (`Math.round`); intermediate math unrounded.
- **Projection horizon:** 20 years → 21 data points (year 0 = today).

### Global default constants

| Constant | Value | Used for |
|---|---|---|
| `appreciationRate` | 0.02 /yr | property value growth |
| `indexationRate` | 0.02 /yr | rent indexation (Belgian health index) |
| `inflationRate` | 0.02 /yr | operating-cost inflation (never property tax) |
| `vacancyRate` | 0.05 | effective rent = gross × (1 − vacancy) |
| Registration tax standard | 0.12 | Flanders, investment/second property (since 01.01.2022) |
| Registration tax reduced | 0.02 | "enige eigen woning" (sole own home, since 01.01.2025; was 3% 2022–2024) |
| Notary estimate | 1% of price + €1,500 | when actual not entered |
| Brokerage on sale | 0.03 | seller cost |
| Prepayment penalty | 0.01 of loan balance | legally capped ≈ 3 months' interest; waived when porting mortgage |
| Rental withholding | 0.30 | simplified rental income tax regime |
| Capital gains (speculation) tax | 0.165 | only if sold < 5 years after purchase; primary residence exempt |
| ETF dividend withholding | 0.30 | on dividend portion only; 0% on ETF capital gains |
| Bond interest tax | 0.30 | withholding |
| Savings interest tax | 0.15 above €1,020 exemption | |
| KI index factor / marginal rate | 1.4 / 0.50 | KI-based rental tax alternative |
| Max LTV (investment) | 0.80 | Belgian bank norm; also the equity-release formula |
| Max LTV (primary residence) | 0.90 | |
| Acquisition cost rate | 0.14 investment / 0.04 primary | registration + notary as fraction of price |
| Default mortgage rate | 0.035 | |
| Default loan term | 240 months | |
| Personal savings rate | 0.10 | household set-aside |
| Growth horizon | 25 years (configurable 5–40) | |
| Income savings buffer | 0.10 | growth sim: only 90% of surplus accumulates |
| ETF return preset | 0.07 | reinvestment scenarios ("IWDA/VWCE historical average") |
| Bonds preset | 0.035; Savings preset 0.015; Custom default 0.05 | |

---

## 2. Data model

Postgres (Supabase) with row-level security. JS objects use camelCase; DB snake_case (a mapping layer converts both ways).

### 2.1 `properties`

| Column | Type | Default | Meaning |
|---|---|---|---|
| id | uuid PK | gen_random_uuid() | |
| user_id | uuid FK auth.users, CASCADE | NULL | NULL = guest/demo row |
| name | text NOT NULL | | display name |
| address | text | | |
| purchase_price | numeric(14,2) | 0 | |
| current_value | numeric(14,2) NOT NULL | 0 | current market estimate |
| valuation_date | date | NULL | when current_value was estimated; projection anchor |
| appreciation_rate | numeric(6,4) | 0.02 | |
| purchase_date | date | | |
| status | text NOT NULL | 'rented' | `owner_occupied` \| `rented` \| `vacant` \| `for_sale` \| `renovation` \| `planned` |
| is_rented | boolean | true | legacy flag, kept in sync (`status === 'rented'`) |
| intended_rental | boolean (JS-level) | | "will be rented out" toggle |
| start_rental_income | numeric(10,2) | 0 | monthly gross rent at rental start (indexation base) |
| monthly_rental_income | (legacy JS field) | | kept in sync with start_rental_income |
| indexation_rate | numeric(6,4) | 0.02 | |
| vacancy_rate | numeric(5,4), CHECK 0–1 | 0.05 | |
| rental_start_date | date | NULL | NULL = rental predates tracking |
| rental_end_date | date | NULL | NULL = open-ended lease |
| is_primary_residence | boolean NOT NULL | false | |
| residence_start_date | date | | blank = already living there |
| residence_end_date | date | | blank = indefinite |
| annual_maintenance_cost | numeric(10,2) | 0 | inflated yearly |
| annual_insurance_cost | numeric(10,2) | 0 | inflated yearly |
| annual_property_tax | numeric(10,2) | 0 | onroerende voorheffing — **never indexed** |
| monthly_expenses | numeric(10,2) | 0 | syndic/misc — inflated yearly |
| inflation_rate | numeric(6,4) | 0.02 | cost indexation |
| registration_tax | numeric, nullable | NULL | **blended rate fraction** (see 9.3); NULL = "use 12% estimate" |
| notary_fees | numeric, nullable | NULL | actual €; NULL = estimate 1% + €1,500 |
| agency_fees | numeric, nullable | NULL | actual € |
| other_acquisition_costs | numeric, nullable | NULL | actual € |
| owners | jsonb NOT NULL | `[{"name":"Me","share":1}]` | array of `{name, share (0–1), registrationTaxRate? (fraction, nullable)}` |
| created_at / updated_at | timestamptz | now() | updated_at via trigger |

### 2.2 `loans`

| Column | Type | Default |
|---|---|---|
| id | uuid PK | |
| property_id | uuid FK → properties CASCADE | |
| lender | text | |
| original_amount | numeric(14,2) | 0 |
| interest_rate | numeric(6,4) | 0 (annual, e.g. 0.03) |
| start_date | date | |
| term_months | integer | 0 (240 used as fallback in calcs) |
| monthly_payment | numeric(10,2) | 0 |

No user_id — RLS via parent property join. A property can have **multiple loans**.

### 2.3 `amortization_schedules`

Imported from bank CSV per loan. When present it **overrides** all formula-based loan math.

| Column | Type |
|---|---|
| id | uuid PK |
| loan_id | uuid FK → loans CASCADE |
| period | integer NOT NULL (payment #) |
| due_date | date |
| capital_repayment | numeric(12,2) |
| interest | numeric(12,2) |
| total_payment | numeric(12,2) |
| remaining_balance | numeric(14,2) |

Index on `(loan_id, due_date)`. Replace-all on re-import; chunked inserts of 400 rows.

### 2.4 `planned_investments`

One-off capital outlay (renovation) planned on a date for a property.

| Column | Type |
|---|---|
| id | uuid PK |
| property_id | uuid FK CASCADE |
| description | text |
| planned_date | date NOT NULL (determines projection year) |
| cost | numeric(14,2) NOT NULL default 0 — cash out that year |
| value_increase | numeric(14,2) NOT NULL default 0 — **permanent** market-value bump from that date |

### 2.5 `household_profile`

| Column | Type | Default |
|---|---|---|
| id | text PK | 'default' (or user uid) |
| user_id | uuid FK | |
| members | jsonb | `[]` — `[{id, name, isMe, netIncome, investmentIncome, cash, investmentPositions[]}]` |
| household_expenses | numeric(12,2) | 0 — joint monthly living costs |
| personal_savings_rate | numeric(6,4) | 0.10 |
| ui_preferences | jsonb | `{dashboardChart, dashboardChartRange, capitalGoals[], dashboardCashflowExcludedLoanKeys[]}` |
| (legacy flat columns my_net_income etc. mirrored from members) | | |

Exactly one member must have `isMe: true` — this member defines "my" ownership share, personal cash, and personal net worth app-wide.

### 2.6 `simulator_profile`

`{id (text PK), user_id, state (jsonb — full simulator input state, schema-less)}`

### 2.7 `growth_planner_profile`

`{id, user_id, acquisitions (jsonb []), horizon_years (int, default 25), max_ltv (numeric, default 0.80)}`

### 2.8 `share_tokens`

`{id uuid, user_id, token (text UNIQUE — base64url of 24 random bytes ≈ 32 chars, client-generated), permissions (jsonb, default {"dashboard":true,"properties":true,"financials":true,"household":false}), created_at}`

### 2.9 RLS & SQL functions

- `properties` / profile tables: `SELECT` where `user_id = auth.uid() OR user_id IS NULL` (guest demo rows); write owner-only.
- `loans`, `amortization_schedules`, `planned_investments`: policies check parent property via `EXISTS` join.
- `claim_ownerless_data(p_user_id)` (SECURITY DEFINER): assigns all NULL-owner rows to the new user on signup; returns per-table counts.
- `resolve_share_token(p_token)` → `{user_id, permissions}` (grant anon).
- `get_shared_portfolio(p_token)` → full JSON: properties (with nested loans + schedules + planned investments), household, growth planner (grant anon).

### 2.10 Portfolio load shape

```js
{
  properties: [{ ...property, loans: [{ ...loan, amortizationSchedule: [...] }], plannedInvestments: [...] }],
  meta: { version: '1.0.0', lastUpdated, currency: 'EUR' }
}
```

---

## 3. Core utilities

### 3.1 Date math

```js
monthsBetween(a, b) = (b.year − a.year) × 12 + (b.month − a.month)   // calendar months, ignores day
addYears(date, n)   = new Date(y + n, m, d)
yearsBetween(a, b)  = (b − a) in ms / (365.25 × 24 × 3600 × 1000)     // fractional years
```

### 3.2 Ownership share

```js
getOwnershipShare(property, personName = 'Me'):
  owners = property.owners ?? [{name:'Me', share:1}]
  match  = case-insensitive name match; fallback = owners[0]
  return Number(match.share ?? 1)     // 0–1
```

### 3.3 Rental-active check (canonical)

```js
isRentalActiveOn(property, date = today):
  hasIntent = status === 'rented' || isRented === true || intendedRental === true || rentalStartDate set
  if (!hasIntent) return false
  if (status === 'planned') return false
  if (rentalStartDate && date < rentalStartDate) return false
  if (rentalEndDate && date > rentalEndDate) return false
  if (status === 'owner_occupied'):
    if (!rentalStartDate) return false
    if (residenceEndDate && date <= residenceEndDate) return false  // still living there
  return true
```

### 3.4 Primary-residence check

```js
isPrimaryResidenceOn(property, date):
  requires isPrimaryResidence flag and date within [residenceStartDate ?? −∞, residenceEndDate ?? +∞]
```

> Quirk in source: one variant (`propertyUtils.js`) reads `occupancyStartDate/occupancyEndDate` while the DB uses `residence_*` — implement consistently on `residenceStartDate/residenceEndDate`.

### 3.5 Ownership/rental fractions within a projection-year window

```js
isPropertyOwnedOn(p, date):
  if no purchaseDate: return p.status !== 'planned'   // planned w/o date excluded
  return purchaseDate <= date

getOwnershipFractionInWindow(p, windowStart, windowEnd):   // handles mid-year purchase
  if no purchaseDate: return status === 'planned' ? 0 : 1
  if purchaseDate >= windowEnd: 0
  if purchaseDate <= windowStart: 1
  else clamp((windowEnd − purchaseDate) / (windowEnd − windowStart), 0, 1)

getRentalActiveFractionInWindow(p, windowStart):
  count months m in 0..11 where owned(windowStart+m) AND isRentalActiveOn(p, windowStart+m)
  return count / 12
```

---

## 4. Loan mathematics

### 4.1 Annuity monthly payment

```
pmt = P · r · (1+r)^N / ((1+r)^N − 1)        r = annualRate/12, N = termMonths
r = 0  →  pmt = P / N
```

### 4.2 Bullet (interest-only) monthly payment

```
pmt = P · annualRate / 12          (principal due in full at maturity)
```

### 4.3 Remaining balance — annuity

```
balance(n) = P · ((1+r)^N − (1+r)^n) / ((1+r)^N − 1)     n = months paid (clamped ≥ 0)
r = 0      → balance = max(0, P · (1 − n/N))
n ≥ N      → 0
```

### 4.4 Remaining balance — bullet

`balance = P` until `monthsPaid ≥ termMonths`, then `0`.

### 4.5 Schedule-first resolution (`getRemainingBalance(loan, dateISO)`)

1. If `loan.amortizationSchedule` exists: take the latest entry with `dueDate ≤ date` → `max(0, remainingBalance)`; if no past entries → `originalAmount`.
2. Else annuity formula with `n = monthsBetween(startDate, date)`, `N = termMonths` (fallback 240).

### 4.6 Annual loan payment in projection-year window (`getAnnualLoanPayment(loan, year)`)

Window = `[today + year, today + year + 1)`.
- With schedule: `Σ totalPayment` of entries whose dueDate falls in window.
- Else: `activeMonths × monthlyPayment` where
  `activeMonths = max(0, min(monthsBetween(start, windowEnd), termMonths) − max(0, monthsBetween(start, windowStart)))`.

### 4.7 Monthly interest/capital split (`getLoanPaymentSplit(loan, date)`)

- With schedule: most recent entry `dueDate ≤ date` → `{interest, capitalRepayment, totalPayment || monthlyPayment}`.
- Missing amount/rate/startDate → `{0, monthlyPayment, monthlyPayment}`.
- Else: `monthlyInterest = getRemainingBalance(loan, date) × annualRate/12`; `monthlyCapital = max(0, monthlyPayment − monthlyInterest)`.

### 4.8 Annual interest at a date (interest-only cost doctrine)

```
getAnnualInterestAtDate(loan, date):
  0 if no startDate/termMonths or date ≥ loanEnd (start + termMonths)
  else getRemainingBalance(loan, date) × (annualRate/12) × 12
```

---

## 5. Belgian tax modules

All pure functions; rates overridable via config objects.

### 5.1 Rental income tax

```js
calculateRentalIncomeTax(grossRent, cfg):
  if (!cfg.useWithholding) return grossRent               // personal declaration — not modeled further
  return grossRent × (1 − (cfg.rentalWithholding ?? 0.30)) // 30% simplified withholding
```

Alternative KI-based regime (informational):
`calculateKIBasedTax(KI, indexFactor=1.4, marginalRate=0.50) = KI × 1.4 × 0.50`

### 5.2 Capital gains ("speculation") tax

```js
calculateCapitalGainsTax(purchasePrice, saleValue, purchaseDate, saleDate, cfg):
  gain  = max(0, saleValue − purchasePrice)
  years = yearDiff + monthDiff/12   (rounded to 0.1)
  applies = years < 5 && cfg.capitalGainsApplies !== false     // primary residence: pass false
  tax = applies ? round(gain × (cfg.capitalGainsRate ?? 0.165)) : 0
  → { capitalGain, tax, taxApplies, yearsSincePurchase }
```

### 5.3 Registration tax (registratierechten)

```js
calculateRegistrationTax(price, cfg):
  rate = cfg.qualifiesForReduction ? (cfg.reducedRate ?? 0.02) : (cfg.standardRate ?? 0.12)
  tax  = round(price × rate)
// Flanders 12% standard; Brussels/Wallonia 12.5%; 2% enige eigen woning since 2025.
// Klein beschrijf abolished; fixed €1,867 reduction for bescheiden woningen ≤ €220k on sole primary home.

calculateCoBuyingRegistrationTax(price, owners, cfg):
  per owner: tax_i = round(price × share_i × rate_i)   (rate per owner's own qualification)
  → { totalTax: round(Σ tax_i), ownerBreakdown }
```

### 5.4 Investment taxes (used when sale proceeds are reinvested)

```js
calculateETFTax(currentValue, principal, dividendPct=0) = round(currentValue × dividendPct × 0.30)
  // ETF capital gains 0%; only dividends taxed. Accumulating ETF → dividendPct 0.
calculateBondTax(interest)      = round(interest × 0.30)
calculateSavingsTax(interest)   = round(max(0, interest − 1020) × 0.15)
```

---

## 6. 20-year projection engine (`buildProjection`)

**The heart of the app.** Input: `properties[]` (each with `loans[]` incl. optional schedules and `plannedInvestments[]`). Output: 21 points (year 0–20).

State across years: `cumulativeCF = 0`; `valueBumps[propertyId] = 0` (cumulative, permanent renovation value bumps).

For each `year` in 0..20, with `yearStart = today + year`, `yearEnd = today + year + 1`, `targetDate = yearStart`:

Per property:

1. **Planned investments in window:** for each `inv` with `yearStart ≤ plannedDate < yearEnd` and property owned at that date:
   `valueBumps[p.id] += inv.valueIncrease`; `plannedInvestCost += inv.cost`.
2. **Value** (if owned at targetDate):
   `value = currentValue × (1 + appreciationRate)^year + valueBumps[p.id]`.
3. **Loan balance** (if owned): `Σ getRemainingBalance(loan, targetDate)`.
4. **Rental income:** `f = getRentalActiveFractionInWindow(p, yearStart)`; if `f > 0`:
   ```
   baseRent      = (startRentalIncome || monthlyRentalIncome) × 12
   grossRent     = baseRent × (1 + indexationRate)^year
   effectiveRent = grossRent × (1 − vacancyRate)
   income       += effectiveRent × f
   ```
5. **Operating costs** (if `ownershipFraction > 0`):
   ```
   costs += (maintenance·(1+infl)^year + insurance·(1+infl)^year
             + monthlyExpenses·12·(1+infl)^year + propertyTax /* fixed */) × ownershipFraction
   costs += Σ getAnnualLoanPayment(loan, year)        // NOT × ownershipFraction (see quirks)
   ```
6. **Investment-only cash-flow series** (for the "investment monthly CF" line; excludes owner-occupied homes). Property qualifies if `status==='rented' || isRented || intendedRental || rentalStartDate`. Uses *timeline semantics*:
   - costs indexed by fractional `yOffset = yearsBetween(today, targetDate)` (property tax fixed);
   - financing cost = **interest only** via `getAnnualInterestAtDate` (capital = equity build);
   - rent indexed by `yearsRenting = yearsBetween(rentalStartDate, targetDate)` (or `year` if no start date), **no vacancy adjustment**;
   - rental active per: `(status==='rented' || rentalStartDate) && date within [rentalStart, rentalEnd]`.
   `investmentCF += rent − costs − interest`.

Point output (all rounded):

```
{ year, label ('Today' | '+Ny'),
  propertyValue, loanBalance,
  netWorth      = propertyValue − loanBalance,
  equityGain    = netWorth − prevNetWorth   (0 at year 0),
  annualCashFlow = income − costs − plannedInvestCost,
  annualCosts    = costs + plannedInvestCost,
  cumulativeCF  += annualCashFlow,
  investmentAnnualCashFlow, investmentMonthlyCashFlow (= /12),
  plannedInvestCost,
  totalReturn   = netWorth + cumulativeCF }
```

---

## 7. Portfolio summary (`computeSummary`)

Current-snapshot KPIs. Signature: `computeSummary(properties, profile?, { tradingPortfolioValue = 0 })`. **Excludes `status === 'planned'` properties entirely.**

```
totalAssets           = Σ currentValue
personalAssets        = Σ currentValue × getOwnershipShare(p, 'Me')
annualRentalIncome    = Σ [isRentalActiveOn(p, today)] monthlyRent × 12 × (1 − vacancyRate ?? 0.05)
activeRentalCount     = count of the above
annualOpex            = Σ (maintenance + insurance + monthlyExpenses×12 + propertyTax)   // NOT indexed, NOT ownership-weighted
per loan: balance     = getRemainingBalance(today) → totalLiabilities (+ personalDebt × myShare)
          split       = getLoanPaymentSplit(today) → annualInterest += mi×12; annualCapital += mc×12
equity                = totalAssets − totalLiabilities
personalRealEstateNW  = personalAssets − personalDebt
personalCash          = isMe member's cash (else first member)
personalNetWorth      = personalRealEstateNW + personalCash + tradingPortfolioValue
annualNetCF           = annualRentalIncome − annualOpex − annualInterest    // capital excluded (equity build)
totalMonthlyCashFlow  = annualNetCF / 12
roe                   = equity > 0 ? annualNetCF / equity × 100 : 0
```

Also returns: `totalNetWorth`, `monthlyInterest`, `monthlyCapital`, `propertyCount`, `loanCount`.

---

## 8. Dashboard features

### 8.1 Investment-ready capital (hero)

```
availableEquity        = Σ over live (non-planned) properties: max(0, currentValue × 0.80 − Σ loanBalance(today))
liquidCash             = personalCash
investmentReadyCapital = availableEquity + liquidCash
```
Breakdown panel: "Reusable property equity (Σ value×80% − debt)", "Liquid savings", "Total ready". Hint: *"Use for: 12% registration tax or 20% own contribution on next purchase."*

### 8.2 KPI pills (each with a tooltip showing the live formula with actual numbers)

Net worth (`personalNetWorth`), Monthly CF (`totalMonthlyCashFlow`), Portfolio LTV = `totalDebt / totalPortfolioValue × 100` ("—" when no value), Property count.

### 8.3 Switchable projection chart

Three chart modes (persisted to `ui_preferences.dashboardChart`), range 5/10/25y (`dashboardChartRange`):

1. **Net worth:** per year i: `Σ currentValue·(1+appRate ?? 0.03)^i − Σ getRemainingBalance(loan, today+i) + personalCash` (planned excluded).
2. **Investment-ready capital:** per year: `Σ max(0, futureValue × 0.80 − futureDebt) + personalCash`.
3. **Monthly cash flow:** reuse `buildProjection`; plot `annualCashFlow/12`; **add back** the annual payments of user-excluded loans.

**Loan include/exclude picker** (cash-flow mode only): checkbox list of every loan (property label, monthly payment, start date, term); All/None shortcuts; persisted as `dashboardCashflowExcludedLoanKeys` (auto-pruned when loans disappear). Excluded payments are added back **pro-rated by `getOwnershipFractionInWindow`** for each projection year.

### 8.4 Equity headroom card

Per live property, sorted by headroom desc: `value×80% − debt = headroom`; LTV mini-bar colored green < 60%, amber < 75%, red ≥ 75%. Footer: total available equity.

### 8.5 Cash flow breakdown card

Rent/12, −interest, −opex/12, = net monthly CF, capital repaid/mo (informational, +), ROE % (when > 0).

### 8.6 Portfolio health score (rule-based, no AI)

```
score = 100
LTV > 80 → −40 | > 65 → −25 | > 50 → −12 | > 35 → −5
monthlyCF < 0 → −18 ;  monthlyCF > 2000 → +5 (cap 100)
propertyCount < 2 → −5
clamp(score, 10, 100)
labels: ≥80 Very Healthy, ≥60 Healthy, ≥40 Fair, else At Risk
```
Rendered as animated radial gauge with side stats (portfolio value, LTV, debt, net worth).

### 8.7 Acquisition power

`buyPowerConservative = investmentReadyCapital × 5` (20% down) — max next-property price; `buyPowerLeveraged = × 10` (10% down).

### 8.8 Capital goals

Goals stored in `ui_preferences.capitalGoals`: `{type:'investment_ready_capital', targetYear, targetAmount}`. Progress bar: green segment = current capital vs target; orange segment = additional projected progress by target year (taken from the 25-year investment-ready-capital projection). Footer: Current / Projected / Gap (or "On track"). CRUD modal: target year (this year → +40) + amount.

### 8.9 Empty state

No properties → "No Properties Yet" + Add Property CTA.

---

## 9. Property form (data entry)

Single form for add + edit (edit hydrates and migrates legacy fields: `isRented → status`, `monthlyRentalIncome → startRentalIncome`, property-level registration rate → per-owner rate).

### 9.1 Toggles

- **Planned/simulated property:** flips status to `planned`, remembers prior status internally to restore on untoggle.
- **Will be rented out** (`intendedRental`): reveals rental section; untoggling while `rented` reverts status to `owner_occupied` (or `planned`).

### 9.2 Status selector

Button grid, 6 statuses with emoji + color badges (see 2.1). Status controls today's cash flow inclusion.

### 9.3 Sections & fields

- **Details:** name*, address, purchase price, current market value*, valuation date, appreciation % (default 2), purchase date.
- **Acquisition costs:** notary, agency, other (blank = estimate). Registration tax entered **per owner**; on save a blended property-level rate is stored:
  `blendedRate = Σ(share_i × rate_i × price) / price`.
- **Ownership:** owner rows `{name (dropdown of household members + "Other…"), share % (whole %, stored 0–1), registrationTaxRate (nullable; hint: standard 12%, enige eigen woning 2% since 2025)}`. Live share-total validation: red > 100%, amber < 100% (when > 1 owner), green = 100%. Add/remove owners (min 1).
- **Primary residence:** toggle + living-from + moving-out dates.
- **Rental (when intendedRental):** monthly rent (`startRentalIncome`), indexation % (default 2, health-index hint), vacancy % (default 5, "≈ 2 weeks"), rental start/end dates. Contextual notices: (a) not-rented-yet reminder to flip status when tenant moves in; (b) amber warning when rented with a future start date ("until DATE cash flow shows €0 rent, only costs").
- **Operating expenses:** annual maintenance, annual insurance, annual property tax (fixed note), other monthly, cost inflation % (default 2). Belgian guidelines panel (apartments €2,000–2,500/yr min, houses €2,500–4,000/yr; syndic bijzondere bijdragen warning €10–15k; Flemish EPC). Amber warning when maintenance < €2,000 showing entry vs recommended ×15-year totals.
- **Loans (repeatable):** lender*, original amount*, annual rate* (%), monthly payment (optional), start date*, term months* (placeholder 240), + amortization CSV import ("Schedule loaded: N rows" / Replace).
- **Timeline preview:** live compact PropertyTimeline while editing (when ≥ 1 loan, or rentalStartDate, or purchaseDate exists).

### 9.4 Save normalization

Coerce numerics (`Number(x) || 0`, or `null` for blank nullable costs); persist per-owner rates + blended rate; derive legacy `isRented`; keep `monthlyRentalIncome` in sync with `startRentalIncome`.

---

## 10. Property detail page

### 10.1 KPI cards

- **Market value** — `currentValue`, subtitle "as of {valuationDate}" (or warning "valuation date not set").
- **Equity (my share)** — `(currentValue − Σ getRemainingBalance(loan, today)) × myShare`; "my" = owner matching `/^me$/i`, else first owner; subtitle shows "X% of {full equity}" when share < 100%.
- **Total invested to date** — `purchasePrice + acquisitionCosts + interestPaidToDate + pastRenovationCosts`.
- **Unrealised gain** — `currentValue − purchasePrice − acqCosts − pastRenovCost`; ROI% = `(currentValue − totalInvested)/totalInvested × 100`.

### 10.2 Acquisition-cost resolution (actual or Belgian estimate)

```
registrationTax = storedRate × purchasePrice        // estimate rate: 0.12 (standard Flemish)
notaryFees      = actual ?? round(purchasePrice × 0.01 + 1500)
agencyFees      = actual ?? 0 ;  otherCosts = actual ?? 0
```

### 10.3 Interest paid to date

Per loan: if schedule → `Σ interest` of rows `dueDate ≤ today`. Else simulate month-by-month from loan start: `pmt = P·r/(1−(1+r)^−n)`; each month `interest = balance × r`; `balance −= (pmt − interest)`; accumulate until today. (`r = annualRate/12`, `n = termMonths ?? 240`.)

### 10.4 Value vs Total Spend chart

Yearly points from purchase year (fallback: earliest loan start, else today−3y) to `max(today+20y, latest loan end, last renovation year)`:

- `propertyValue`: if past `valuationDate` (default today) → `currentValue × (1+appRate)^yearsSinceValuation`; before it → `purchasePrice × (1+appRate)^yearsSincePurchase`.
- `cumulativeSpend`: purchase + acquisition costs + interest paid (frozen at today's figure for future years) + cumulative renovation costs by year.
- `equity`: propertyValue − remaining balance (schedule or annuity; **frozen at today for future years**).

Rendering: 3 gradient area series (value green, spend amber, equity sky); "Today ★" dashed reference line; violet vertical lines per renovation labeled "🔨 description · €cost"; caption states anchor + appreciation rate, amber warning when no valuation date.

### 10.5 Cost breakdown table

Purchase price (+date) / registration tax (rate %, "(actual)" vs "estimated (standard 12%…)") / notary ("estimated (1% + €1,500)") / agency / other / interest paid ("from schedule" vs "estimated") / renovations completed / **total invested** / current value / unrealised gain (+ROI%).

### 10.6 Renovation history table

From `plannedInvestments` sorted by date: Date (future rows tagged "planned"), Description, Cost (red), Value added (green), Net = value − cost (color-coded); totals footer.

### 10.7 Loan cards

Per loan: lender, "€orig at X.XX% — N months", remaining balance, % repaid = `(1 − remaining/original)×100` with progress bar, monthly Interest/Capital/Total tiles (from `getLoanPaymentSplit`), "Schedule uploaded (N rows)" note.

### 10.8 Full timeline

Embedded PropertyTimeline (non-compact) when the property has loans, a rentalStartDate, or a purchaseDate.

---

## 11. Property timeline

Horizontal life-of-property visualization; `compact` variant (dashboard cards / form preview) hides header, legend, CF bars, milestones.

- **Span:** purchase date (fallback earliest loan start, else today−1y) → `max(latest loan maturity, rentalEndDate, today) + 5y` (+3y compact).
- **Phase track:** contiguous segments: `loan-only` (red), `loan+rent` (amber), `rent-only` (emerald), `no-income` (grey), `profit` (bright emerald "Pure profit") — derived from ordering of rental window vs loan-end.
- **Markers:** Today (white), rental start (emerald), loan end (amber); year ticks (step 2/5/10 by span).
- **Year-by-year financials (hover tooltip):**
  ```
  loanBalance    = Σ getRemainingBalance(loan, date)
  annualInterest = Σ active loans: balance × rate/12 × 12
  annualCapital  = Σ (monthlyPayment − monthlyInterest) × 12
  annualRent     = active if (status='rented' || rentalStartDate) && date in [start, end]:
                   (startRentalIncome || monthlyRentalIncome)×12 × (1 + indexationRate ?? 0.02)^yearsRenting
                   // NOTE: no vacancy applied here
  annualCosts    = (maintenance + insurance + monthlyExpenses×12) × (1+inflation)^yearsFromToday + propertyTax
  annualCF       = rent − costs − interest        // capital = equity, not cost
  cumulativeCF   accumulated from year 1
  ```
- **Annual CF bar chart:** mirrored bars around zero (green up / red down), scaled to max |CF|.
- **Milestones strip:** Today; "Loan ends YEAR"; "Rental starts MONTH YEAR"; "Pure profit from YEAR (€X/yr rent)" = first year with `annualCF > 0 && loanBalance === 0`.

---

## 12. Money Flow & Cash Flow Aggregator

### 12.1 Money Flow ("every euro in and out")

Two net-position KPIs (monthly + annual):
- **Portfolio net CF** = grossRent − propertyOpex − loanInterest (capital excluded).
- **Household surplus (investable)** = totalInflow − totalOutflow.

**Portfolio panel** (per property): rent row only if `isRentalActiveOn(p, today)`, `rent = (startRentalIncome || monthlyRentalIncome) × (1 − vacancyRate ?? 0.05)`; inactive rows show dimmed status text ("rental not yet started" / "owner-occupied — no rental income" / "vacant" / "under renovation"). Indented outflows per property: operating costs (`maintenance/12 + insurance/12 + propertyTax/12 + monthlyExpenses`; label "maintenance, insurance, tax, syndic"), loan interest, capital repayment (teal "↑ builds equity") via `getLoanPaymentSplit`.

**Household panel:** inflows = gross portfolio rent + per member (netIncome + investmentIncome). Outflows = property opex, loan interest, capital repayment (shown but **not** subtracted), living expenses (`householdExpenses`), savings set-aside = `totalInflow × personalSavingsRate` (amber "reserved, not available"). Total = **Available for New Investments** = `inflow − (opex + interest + householdExpenses + savingsSetAside)`. Warning banner when no members configured.

**Cash on hand:** per-member liquid-cash chips + household total.

**Year-by-year table** (portfolio-only, from `buildProjection`): Year (Year-0 = "Today"), Portfolio Value, Loan Balance, Equity, Rental Income (reverse-engineered = `annualCashFlow + annualCosts`), Costs, Portfolio CF, Cumulative CF. Show-6/show-all toggle. Salaries explicitly excluded.

### 12.2 Cash Flow Aggregator

KPI strip: **Total monthly inflow** = vacancy-adjusted gross rent (uses legacy `isRented !== false` check) + Σ member incomes; **Total monthly outflow** = property opex + **full loan payments** (Σ monthlyPayment — deliberate difference from Money Flow) + household expenses + savings set-aside; **Available for investment** = inflow − outflow; **Annual investable** = ×12.

Formula-breakdown card with +/−/= operator rows; household members card (income/cash per member + totals); edit-profile button; warning when no members.

---

## 13. Projection page

Driven by `buildProjection`. Every metric has an info-popover with its formula text.

- **Inflation toggle:** divides every monetary series by `1.02^year` (real purchasing power).
- **"My share" approximation** for personal series: `myShareRatio = Σ(currentValue × myShare) / Σ(currentValue)` applied to total net worth.
- **Chart 1 — Value vs Debt:** stacked bars per year: loan balance (red) → property equity (green) → optional investments/trading overlays; dashed amber **Total Return** line (= netWorth + cumulativeCF); cyan **investment monthly CF** line (right axis; investment properties only, interest-only doctrine); vertical 🔨 markers at planned-investment years.
- **Chart 2 — Net CF per year** (only when ≥ 1 rented property): bars = `annualCashFlow`; violet cumulative line — zero-crossing = **cash breakeven point**.
- **Chart 3 — Equity growth per year** (skips year 0): green bars `equityGain`, red bars `−annualCosts`, sky line netWorth.
- **20y summary strip:** property gain, debt repaid, net-worth gain, total return (each = year-20 − year-0).
- **Property breakdown table:** current value; +5y = `value·(1+r)^5`; +20y = `value·(1+r)^20`; appreciation %; rent index %; loan count.
- **Annual detail table:** year, value, balance, net worth, annual CF, cumulative CF, total return (+optional combined-view columns); popover notes balance comes from CSV schedule when present, else annuity formula.
- **Calculation breakdown card** (collapsible audit of one data point): assets (value formula + bumps), −liabilities, = net worth; CF components (rent = `annualCashFlow + annualCosts` derived, −opex, −planned investments), cumulative CF; total return. Comparison variant adds investment value (sold proceeds compounded), investment tax paid (Belgian TOB/dividend note), and a net-worth-difference verdict ("better"/"worse"/"roughly equivalent" within €1,000).

---

## 14. Scenario Planner (keep / sell / occupy)

Per-property decisions vs "Keep All" baseline over 20 years.

### 14.1 UI

- Per-property card: name, value, equity (= value − Σ balances today), monthly rent (if rented). Action: **Keep & Rent** / **Sell & Invest** / **Owner Occupy**.
- Sell options: investment preset (ETF 7% / Bonds 3.5% / Savings 1.5% / Custom 5%, 0–20% editable) + sale timing (year 0/1/2/3/5/10).
- Tax config panel: withholding 30% vs personal declaration (radio); capital-gains 16.5% < 5y checkbox (default on); ETF dividend % slider 0–100 (30% tax on dividend portion; accumulating = 0%).
- Outputs: kept/sold count banner; crossover-year insight (first year custom NW > baseline NW); 20y area chart (baseline vs custom); year-20 summary cards (NW both + diff € and %, cumulative CF both + diff, recommendation = higher year-20 NW); calculation-breakdown card; year-by-year table (key years 0/5/10/15/20 or all) with per-row Better badge (Neutral if |diff| < €1,000).

### 14.2 Engine (`buildPropertyScenarioComparison(properties, {decisions, taxConfig})`)

Baseline = `buildProjection(properties)`. Custom, per year 0–20:

- **Sold property** (year ≥ saleYear): once, at saleYear, compute `computePropertySaleProceeds` (see §15). Then track as investment:
  `investmentValue = netProceeds × (1 + investmentRate ?? 0.07)^(year − saleYear)`;
  annual ETF tax = `calculateETFTax(investmentValue, principal, etfDividendPct)` added to costs. Property contributes no value/loan/rent thereafter.
- **Kept property:** `value = currentValue × (1+appRate ?? 0.02)^year`; balance via `getRemainingBalance`. Rent only when action = `keep` **and** `isRentalActiveOn(p, yearStart)`:
  `grossRent = baseRent×12 × (1+indexRate ?? 0.02)^year`; `effectiveRent = gross × (1 − vacancy ?? 0.05)`; `netRent = calculateRentalIncomeTax(effectiveRent, taxConfig)`.
  **Occupy** = kept with no rental income.
- Costs: maintenance/insurance/monthlyExpenses inflated `(1+infl ?? 0.02)^year`; property tax fixed; loan payments via `getAnnualLoanPayment`; + investment tax.
- Point: `{propertyValue, investmentValue, loanBalance, netWorth = pv + iv − lb, annualCashFlow, cumulativeCF, totalReturn = netWorth + cumulativeCF, investmentTax}` merged with baseline into `{baselineNetWorth, baselineCF, customNetWorth, customCF, delta, deltaCF}`.

### 14.3 Net yield reality check (kept + rented properties)

```
grossAnnualRent = monthlyRent × 12
effectiveRent   = grossAnnualRent × (1 − vacancy ?? 0.05)
netRent         = withholding ? effectiveRent × 0.70 : effectiveRent
totalCosts      = maintenance + insurance + propertyTax + monthlyExpenses×12 + Σ loanMonthlyPayment×12
netIncome       = netRent − totalCosts
grossYield      = grossAnnualRent / propertyValue × 100
netYield        = netIncome / propertyValue × 100
```
Color: < 2% red, < 4% orange, < 5% yellow, ≥ 5% green. Monthly net CF = netIncome/12. Warning banner when netYield < 3% ("consider selling and investing elsewhere").

---

## 15. Sale proceeds engine

### 15.1 Single property (`computePropertySaleProceeds(property, saleYear, taxConfig, costConfig)`)

```
grossValue        = currentValue × (1 + appRate ?? 0.02)^saleYear
loanBalance       = Σ getRemainingBalance(loan, saleDate)
brokerageFee      = grossValue × (brokeragePct ?? 0.03)
prepaymentPenalty = loanBalance × (prepaymentPct ?? 0.01)      // 0 when mortgage is ported
capitalGainsTax   = calculateCapitalGainsTax(purchasePrice ?? currentValue, grossValue,
                                             purchaseDate, saleDate, taxConfig).tax
netProceeds       = grossValue − loanBalance − brokerageFee − prepaymentPenalty − capitalGainsTax
```
Returns full breakdown + `yearsSincePurchase`.

**Mortgage portability toggle** ("I will buy another property"): sets `prepaymentPct = 0`, displays penalty avoided (`loanBalance × 1%`) and explanation (keep old rate on ported balance, borrow only the extra at current rates).

### 15.2 Whole portfolio (`computeSaleProceeds(properties, saleYear, config)`)

Same per-property appreciation/balance; totals: `netProceeds = totalSaleValue − totalLoanBalance − brokerage − registration (default 0) − prepaymentPenalty`. No capital-gains at portfolio level.

### 15.3 Hold vs Sell (`buildScenarioComparison(properties, saleYear, config)`)

`holdValue` = projection net worth per year. `sellValue` = holdValue before saleYear; from saleYear on: `netProceeds × (1 + reinvestRate ?? 0.05)^(year − saleYear)`.

---

## 16. Property Simulator (future acquisition)

### 16.1 Inputs (defaults)

Acquisition: price €300,000; renovation €15,000 (one-off in acquisition year); initial market value €300,000; years until purchase 2 (0–19); appreciation 2%.
Registration tax: solo rate 12% **or co-buying mode** — my share 50%, my rate 12%, partner rate 2%:
`totalTax = price × myShare × myRate + price × (1 − myShare) × partnerRate` (full tax hits acquisition-year cash flow).
Rental: rent €1,200/mo; indexation 2%.
Costs: maintenance €600/yr; insurance €400/yr; property tax €800/yr (fixed); other €100/mo; inflation 2%.
Financing: loan €240,000; rate 3.5%; monthly payment €1,200; term 240 (12–360).
State auto-saved (debounced 800 ms) to `simulator_profile.state`, merged over defaults on load.

### 16.2 Engine (`simulateNewProperty(existing, sim)` → `{baseline, withNew, delta}`)

Baseline = `buildProjection(existing)`. Before acquisition year, withNew = baseline. From acquisition year (`yearsOwned = year − acquisitionYear`):

```
newValue    = initialValue × (1 + appRate)^yearsOwned
newLoanBal  = acquisition year → loanAmount; after → getRemainingBalance(syntheticLoan, date)
              syntheticLoan = { originalAmount, rate, startDate = acquisitionDate, termMonths ?? 240 }
rent        = monthlyRent×12 × (1 + indexation)^yearsOwned
opex        = (maintenance + insurance + monthlyExpenses×12) × (1+inflation)^yearsOwned + propertyTax
loanPmts    = payment × active months within the year window, capped at termMonths
oneOff      = acquisition year only: renovationCost + registrationTax
addedCF     = rent − opex − loanPmts − oneOff        (accumulated into cumulativeCF)
netWorth    = baseline.propertyValue + newValue − baseline.loanBalance − newLoanBal
delta[y]    = withNew[y] − baseline[y]  (all metrics)
```

### 16.3 Outputs

Tiles: gross yield = `rent×12/price×100` (green ≥ 4%); year-1 net CF; +20y net-worth boost (`delta[20].netWorth`); +20y cumulative-CF boost. Upfront registration-tax banner (solo or per-buyer split). Three charts with amber "Buy" reference line: net worth (baseline vs with-new), cumulative CF, incremental delta (bars + line). Snapshot table for years 0,1,2,3,5,7,10,15,20 (acquisition row highlighted).

---

## 17. Growth Planner (snowball roadmap)

### 17.1 Position metrics

- Portfolio equity = `computeSummary().totalNetWorth`.
- Monthly surplus = `max(0, Σ member(netIncome + investmentIncome) − householdExpenses − Σ loanMonthlyPayments + rentalNetCF)`.
- Available equity = `Σ max(0, value × 0.80 − debt)` per property.
- Est. borrowing power = `max(0, totalNetWorth × 0.8)`.

### 17.2 Simulation (`simulateGrowthRoadmap(properties, profile, config)`) — month-by-month

Config: `horizonYears = 25`, `plannedAcquisitions[]`, `maxLTV = 0.80`, `startingCash` (= Σ member cash), `incomeSavingsBuffer = 0.10`.

Setup: deep-copy portfolio into sim objects. Per property: `simMonthlyExpenses = (maintenance + insurance + propertyTax)/12 + monthlyExpenses`; `isRentedInSim = status==='rented' || isRented || startRentalIncome > 0`; existing loans = annuities seeded with `simBalance = getRemainingBalance(loan, today)`, `termMonths ?? 240`.

For each `monthIdx` in 0..horizonMonths:

1. **Appreciate:** `simValue = originalValue × (1 + appRate ?? 0.02)^(monthIdx/12)`.
2. **Loan balances:** annuity formula from each loan's own start date; bullet loans stay at original amount until maturity, then 0.
3. **Surplus:**
   ```
   rentalNetCF     = Σ rented: rent·(1+idx)^(m/12) × (1 − vacancy ?? 0.05) − opex·(1+infl)^(m/12)
   surplus         = memberIncome − householdExpenses − Σ simMonthlyPayments + rentalNetCF
   effectiveSurplus = max(0, surplus × (1 − 0.10))
   ```
4. **Accumulate** (from month 1): `accumulatedCash += effectiveSurplus`.
5. **Acquisition trigger** (FIFO — only the first pending acquisition is checked each month):
   ```
   costRate         = acq.acquisitionCostRate ?? (isPrimary ? 0.04 : 0.14)
   acquisitionCosts = targetPrice × costRate × myShare
   ltv              = isPrimary ? min(0.90, maxLTV + 0.10) : maxLTV
   maxBankLoan      = targetPrice × ltv × myShare
   requiredOwnFunds = max(0, targetPrice × myShare + acquisitionCosts − maxBankLoan)
   if (accumulatedCash ≥ requiredOwnFunds):
     deduct funds; create sim property (vacancy 4% investment / 0 primary; rented if !primary && rent>0)
     loan: amount = maxBankLoan; bullet iff loanType ∈ {bullet_loan, ipt_bullet, liquidatiereserve_bullet}
     payment = bullet ? P·rate/12 : annuity(P, rate ?? 0.035, (termYears ?? 20)×12)
     record milestone { monthIndex, year, month, label, propertyPrice, mySharePrice, cashUsed,
                        newLoanAmount, acquisitionCosts, monthlyPayment, isBullet,
                        recommendedLoanType, portfolioSnapshot {value, debt, netWorth, monthlyCF, cash, count} }
   ```
6. **Yearly snapshot** (every 12th month): `{year, portfolioValue, totalDebt, netWorth, monthlyCashFlow (after-mortgage rental CF), monthlySurplus, accumulatedCash, acquisitionsToDate}`.

Returns `{milestones, yearlyData, summary: {readyInMonths (first milestone month or null), totalProperties, finalNetWorth, finalMonthlyCF, finalMonthlySurplus}}`.

Note: milestone snapshot's `monthlyCashFlow` subtracts loan payments (after-mortgage); the surplus loop's `rentalNetCF` does not (payments subtracted separately in the surplus formula).

### 17.3 Chart & journey UI

Snowball chart merges **reconstructed history** (per real property back to earliest purchase year: `historicalValue = currentValue / (1 + appRate)^yearsFromNow`, loan balances at mid-year snapshots) with simulated future. Series: portfolio value (area), net worth (area), total debt (line), monthly CF (dashed, right axis). Reference lines: blue = real purchase years, violet = planned-status properties, amber = simulation milestones (#1, #2-#3 grouped). Property journey: read-only cards for existing properties + editable acquisition config cards (label, primary toggle → auto 4%/14% costs + 90%/80% LTV + rent disabled, target price, my share %, rent, expenses, appreciation, cost %, loan type dropdown (auto-fills type's min rate), rate, term 5–30y; header shows trigger timing "+Xy (Mon YYYY)" or "Not within horizon"; loan summary panel: loanAmount, monthlyPayment, downPayment = `price × myShare × (1 − ltv)`, acqCosts, requiredOwnFunds).

### 17.4 Auto-generate plan

Inputs: base price today (€300k), annual price appreciation (3%), rent as % of price (0.4%/mo), my share, strategy (Balanced = standard mortgage / Max Cash Flow = bullet). Two passes: (1) run sim with 25 identical base-price templates to find trigger months; (2) re-price each acquisition at `basePrice × (1 + apprec)^(triggerMonth/12)` rounded to €5k, inflate monthlyExpenses at 2%/yr, apply predicted rate.

**Interest-rate forecast:** `rate(t) = 0.030 + (0.035 − 0.030) × e^(−ln2 · t / 7)` — decay from 3.5% toward 3.0% with 7-year half-life.

Plan persistence: `{acquisitions, horizonYears, maxLTV}` debounce-saved (400 ms).

---

## 18. Belgian loan-type catalog

Static reference data (2024–25 market rates). Global note: mortgage-interest deduction abolished for all non-primary-residence property as of 01.01.2025; only IPT premiums remain deductible (company level).

| id | Name (NL / EN) | Rate | Security | Payment style | LTV | Term | Key notes |
|---|---|---|---|---|---|---|---|
| hypothecaire_lening | Hypothecaire lening / Standard mortgage | 3.0–3.5% | registered mortgage | annuity | 80% | 20y | lowest rate; ~1% registration cost on the mortgage deed |
| hypothecair_mandaat | Hypothecair mandaat / Mortgage mandate | 3.5–4.0% | mandate (power of attorney) | annuity | 80% | 20y | ~€5k cheaper upfront on €200k; bank can register without notice |
| belofte_van_hypotheek | Belofte van hypotheek / Mortgage promise | 4.0–5.0% | unenforceable promise | annuity | 70% | 20y | weakest security, rarely accepted; high risk |
| bullet_loan | Bulletkrediet / Bullet loan | 3.5–4.5% | varies | **interest-only** | 75% | 10y | payments 4–5× lower than annuity; needs exit plan |
| ipt_bullet | IPT + Bulletkrediet | ~bullet rates | — | interest-only | 75% | 15y | principal repaid by IPT pension plan; **only tax-deductible type** (premiums 100% company-deductible under 80% rule); self-employed/directors; capital locked to age 60–67 |
| liquidatiereserve_bullet | Liquidatiereserve + Bullet | ~bullet rates | — | interest-only | 75% | 10y | company liquidation reserve repays bullet (5% tax vs 30% dividend withholding; 5-year holding; VVPRbis) |
| persoonlijke_lening | Persoonlijke lening / Personal loan | 5–8% | none | annuity | — (max ~€75k) | 5y | gap/acquisition-cost financing only; hurts affordability |

Each entry also carries: `bestFor[]` use cases, riskProfile, prosEN/consEN, taxNote2025, summary, display color. Helpers: `getLoanType(id)`, `getLoanTypesForUseCase(useCase)`.

**Recommendation ranking** (passive-income score): bullet_loan & ipt_bullet ★5, liquidatiereserve_bullet ★4, hypothecaire_lening ★3, hypothecair_mandaat ★2, belofte & persoonlijke ★1; with verdict text and "interest-only ≈ 4–5× lower payment" callout.

---

## 19. Acceleration advice engine

Pure sensitivity analysis (no AI). Baseline = `simulateGrowthRoadmap(...)`; for each lever, re-run with one change; `monthsSaved = baseline.readyInMonths − new.readyInMonths` (first acquisition). Levers:

1. **Release equity:** add `computeAvailableEquity` (80% LTV) to starting cash; suggests refinancing / hypothecair mandaat.
2. **Extra savings:** +€200/mo and +€500/mo variants (modeled as reduced householdExpenses).
3. **Bullet-loan switch** (if first acquisition isn't bullet): annuity − interest-only payment difference; only shown if saving > €50/mo.
4. **Lower target price:** −5% and −10% variants.
5. **Longer loan term:** +5y (max 30; only if current < 25); shown when it saves months and payment drops > €20/mo; warns of higher total interest.
6. **Higher rent:** +10% on existing rented properties (approximated as reduced household expenses); shown if saves months and > €50/mo.
7. **Higher LTV:** request 90% if first acquisition is primary and maxLTV < 0.90. *(Source has an undefined-variable bug here — use `config.maxLTV`.)*

Each item: `{id, category (equity|income|loan_structure|target), title, description, monthsSaved, isImmediate (new readyInMonths === 0), monthlyImpact, color, icon}`. Sort: immediate first, then monthsSaved desc; dedupe to one per category except `target` and `income` (two allowed).

---

## 20. Household profile

Editor for the profile consumed by all cash-flow/growth features:

- **Members:** add/remove/rename (uuid ids); cannot remove last member or the `isMe` member; exactly one `isMe` (star toggle). Per member: net monthly salary (after tax), investment income (monthly), available cash. Summary strip: combined monthly income, total cash.
- **Costs & savings:** joint monthly expenses; personal savings rate (accepts `15` or `0.15`).
- Feeds: liquid cash → investment-ready capital; incomes → money flow/aggregator/growth surplus; member names → owner dropdowns.
- (Per-member investment positions exist for the stock side — out of scope here.)

---

## 21. Sharing, guest mode, AI insights

- **Sharing:** owner generates public link (`/#share/{token}`); permission groups dashboard/properties/financials/household (default household off); toggle/copy/revoke. Shared page renders read-only via `get_shared_portfolio` RPC (anon).
- **Guest/demo:** NULL-user rows visible to everyone; `claim_ownerless_data()` on signup transfers them.
- **AI insights:** builds a system+context prompt from `computeSummary` + per-property lines (value, rent, loans) with suggested questions ("Can I afford to buy a new rental property in 2 years?", "What rental yield should I target?", "Suggest a realistic 5-year acquisition roadmap"). Shows portfolio stats (N properties, M loans) above the chat.

---

## 22. Known quirks & porting decisions

Decide deliberately whether to replicate or fix these:

1. **Interest vs capital doctrine differs by view (intentional):** Dashboard, Money Flow, timeline, and projection "investment CF" treat only *interest* as cost (capital = equity building). Cash Flow Aggregator and the scenario yield-check subtract *full* loan payments. Pick one doctrine per view and document it.
2. **Vacancy NULL→0 mapping:** the service maps DB NULL vacancy to `0`, while calculations use `?? 0.05` — a loaded 0 silently disables vacancy. Normalize (recommend: null stays null, calc default 5%).
3. **Field-name mismatch:** `isPrimaryResidenceOn` checks `occupancyStartDate/occupancyEndDate` vs DB `residence_*`. Use `residence*` consistently.
4. **Loan payments not ownership-weighted** in `buildProjection` (operating costs are). Decide: weight both or neither.
5. **Timeline rent ignores vacancy** (projection engine applies it). The investment-CF series in `buildProjection` intentionally mirrors the timeline (no vacancy).
6. **Growth-advice lever 7 bug:** undefined `maxLTV` reference — use `config.maxLTV`.
7. **Aggregator uses legacy `isRented !== false`** instead of `isRentalActiveOn` — future-dated rentals count as income there. Recommend standardizing on `isRentalActiveOn`.
8. **Two rent-timing models coexist:** projection indexes rent by projection year (`(1+idx)^year`); timeline/investment-CF index by years since `rentalStartDate`. The second is more correct for late-starting rentals.
9. **`personalInvestmentValue`** in computeSummary is a 1-year proxy (`Σ monthlyAmount × 12`), not a real portfolio value.
10. **Blended registration-tax rate** stored at property level is a backward-compat artifact; per-owner rates are the source of truth.
