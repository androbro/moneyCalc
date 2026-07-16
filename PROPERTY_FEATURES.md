# Property Feature Catalog — moneyCalc

Complete inventory of all **real-estate property** functionality in this app (stock/ETF/Revolut trading excluded, noted only where property data merges into combined views). Purpose: pick which features to port to Adapt Tracker; chosen features will then get an in-depth spec (formulas + data model) for reimplementation by an AI agent.

Each feature is numbered so you can reference it directly (e.g. "I want 1, 7, 19, 30").

---

## A. Property records & data entry

**1. Property record (core financials)** — Name, address, purchase price, current market value, valuation date (anchor for projections), annual appreciation rate (default 2%), purchase date.
Source: `src/components/PropertyForm/PropertyForm.jsx`, table `properties`.

**2. Property status lifecycle** — Six statuses: owner-occupied, rented out, vacant, for sale, under renovation, planned/simulated. Status controls what counts in today's cash flow. Includes legacy `isRented` migration.

**3. Planned / simulated properties** — A property flagged "planned" is included in future projections but excluded from today's cash flow, net worth KPIs, and dashboard counts. Used to model a future purchase alongside real ones.

**4. Acquisition costs (Belgian)** — Per property: notary fees, agency/broker fees, other costs; blank fields auto-estimate (notary = 1% of price + €1,500; registration tax = 12% standard Flemish rate). Registration tax is entered **per owner** (12% investment / 2% enige eigen woning since 2025) and blended into a property-level rate by ownership share.

**5. Co-ownership** — Multiple owners per property with name (linked to household members) and share %; live validation that shares sum to 100%. "My" share (owner named "Me") drives personal net worth, personal equity, and personal debt everywhere in the app.

**6. Primary residence lifecycle** — Flag + "living there from" / "moving out" dates; grants capital-gains exemption and 2% registration rate; suppresses rental income while occupied.

**7. Rental configuration** — Monthly gross rent (starting point), annual rent indexation (default 2%, Belgian health index), expected vacancy rate (default 5%), rental start/end dates (open-ended if blank). Contextual warnings, e.g. "until rental start date cash flow shows €0 rent, only costs".

**8. Operating expenses** — Annual maintenance, annual insurance, annual property tax (onroerende voorheffing — kept fixed, never indexed), other monthly expenses (syndic etc.), cost inflation rate (default 2%, applied to everything except property tax). Belgian guideline panel (apartments €2,000–2,500/yr min, houses €2,500–4,000/yr) with a warning when maintenance is entered below the minimum.

**9. Loans / mortgages (multiple per property)** — Lender, original amount, annual interest rate, monthly payment (optional — annuity computed if absent), start date, term in months.

**10. Amortization schedule CSV import** — Upload a bank's amortization table per loan (period, due date, capital, interest, total, remaining balance). When present it is used **instead of** the annuity formula for balances, payment splits, and interest paid. Stored in `amortization_schedules` (chunked inserts of 400 rows).

**11. Planned investments / renovations** — Per property: planned date, description, cost (cash out that year), expected value increase (immediate market-value bump). Live "net value impact" preview. Feeds the projection engine (value bumps + cash outflows), detail-page charts, and history tables.

## B. Property detail page & timeline

**12. Property KPI cards** — Market value (with valuation date), equity = value − Σ remaining loan balances (× my share), total invested to date = purchase + acquisition costs + interest paid + past renovations, unrealised gain + ROI %.

**13. Interest-paid-to-date engine** — Sums the `interest` column of the amortization schedule up to today; without a schedule it simulates month-by-month using the annuity payment formula `pmt = P·r/(1−(1+r)^−n)`.

**14. Value vs Total Spend chart** — Year-by-year area chart from purchase year to +20y: market value (compounded from valuation date), cumulative spend (purchase + costs + interest, frozen at today, + renovations), equity (value − loan balance). "Today" reference line and 🔨 markers per renovation.

**15. Cost breakdown table** — Every acquisition cost line with "(actual)" vs "estimated" labels, interest paid, renovations, total invested, current value, unrealised gain.

**16. Renovation & investment history table** — Date (future items tagged "planned"), description, cost, value added, net impact, with totals row.

**17. Loan summary cards** — Per loan: remaining balance, % repaid progress bar, monthly interest/capital/total split (from schedule or formula), schedule-uploaded indicator.

**18. Property timeline** — Horizontal life timeline with colored phases (loan-only / loan+rent / rent-only / no-income / **pure profit**), markers for today, rental start, loan end; hover any year for a financial tooltip (rent, costs, interest, capital, balance, annual + cumulative CF); mirrored annual cash-flow bar chart; milestone strip incl. "Pure profit from YEAR (€X/yr)". Compact variant embedded in dashboard cards and the property form (live preview while editing).

## C. Dashboard

**19. Investment-ready capital (hero metric)** — `Σ max(0, value × 80% − debt)` per property (Belgian 80% LTV rule) + liquid cash, with a breakdown panel and hint "use for 12% registration tax or 20% own contribution on next purchase".

**20. KPI pills with live formula tooltips** — Net worth (my property equity + cash + trading), monthly cash flow (rent − opex − interest; capital excluded), portfolio LTV, property count. Each tooltip shows the actual formula with live numbers.

**21. Switchable projection chart** — Three charts (net worth / investment-ready capital / monthly cash flow), 5/10/25-year range, per-loan include/exclude picker for the cash-flow chart (excluded payments added back pro-rated by ownership). Choice + range + exclusions persisted per user.

**22. Equity headroom card** — Per property: `value×80% − debt = headroom` with color-coded LTV mini-bars (green <60%, amber <75%, red ≥75%) and total available equity.

**23. Cash flow breakdown card** — Rent, interest, operating costs, net monthly CF, capital repaid/mo (informational), return on equity %.

**24. Portfolio health score** — Rule-based 10–100 gauge: penalties for high LTV (−40/−25/−12/−5 at >80/65/50/35%), negative CF (−18), <2 properties (−5); bonus for CF > €2k. Labels Very Healthy → At Risk.

**25. Acquisition power** — Investment-ready capital × 5 (conservative, 20% down) and × 10 (leveraged, 10% down) = max next-property price.

**26. Capital goals** — Goals with target year + target €; dual-color progress bar (current capital + projected additional progress by target year from a 25-year projection); gap / on-track verdict.

## D. Cash flow & projections

**27. Money Flow statement** — "Every euro in and out": per-property rent rows (respecting rental start dates and vacancy), indented outflows (opex, loan interest, capital repayment shown as ↑ equity-building not expense), merged with household income (salaries, investment income), living expenses, savings set-aside → "Available for New Investments". Per-member cash chips. Year-by-year 20y portfolio table.

**28. Cash Flow Aggregator** — KPI view of total monthly inflow / outflow / available-to-invest with an operator-coded formula breakdown (+/−/=). Note: subtracts **full** loan payments, unlike Money Flow / Dashboard which subtract interest only.

**29. Household profile** — Members (add/remove, "me" flag), net monthly salary, investment income, available cash, joint monthly expenses, personal savings rate. Feeds liquid cash, investment-ready capital, growth planner surplus, and money-flow merging. (Investment positions per member exist but are stock-side.)

**30. 20-year projection engine (`buildProjection`)** — The core engine: per year computes property value (appreciation + permanent renovation value bumps), loan balances (schedule or annuity), indexed vacancy-adjusted rent (pro-rated by months active and ownership fraction, handles mid-year purchases), indexed costs + fixed property tax, planned-investment cash outflows, net worth, annual + cumulative cash flow, total return, and a separate investment-only cash-flow series (interest-only, excludes owner-occupied homes).

**31. Projection page** — Stacked chart of loan balance / property equity / (investments/trading overlays), total-return line, investment monthly CF line, 🔨 planned-investment markers; net-CF-per-year chart with cumulative line (cash breakeven point); equity-growth-per-year chart; global "adjust for inflation" toggle (÷1.02^year); 20-year summary deltas; per-property breakdown table (+5y/+20y values); annual detail table. Every metric has an info-popover with its formula.

**32. Calculation breakdown audit card** — Collapsible walkthrough of a projection data point: assets, liabilities, net worth, cash-flow components, cumulative CF, total return; comparison variant for sell-vs-keep scenarios incl. Belgian investment-tax line.

## E. Scenarios, simulation & growth planning

**33. Scenario Planner (keep / sell / occupy per property)** — Per-property decision cards vs "Keep All" baseline over 20 years: sell timing (year 0–10), reinvestment presets (ETF 7%, bonds 3.5%, savings 1.5%, custom), crossover-year insight, comparison chart, year-20 summary + recommendation, year-by-year comparison table.

**34. Belgian tax configuration (scenarios)** — 30% rental withholding vs personal declaration; 16.5% capital-gains (speculation) tax toggle for sales < 5 years; ETF dividend-percentage slider (30% dividend withholding on the dividend portion).

**35. Net yield reality check** — Per rented property: gross rent → vacancy → withholding tax → all costs incl. mortgage → net income; gross & net yield % color-coded (<2% red … ≥5% green); low-yield warning suggesting sell-and-reinvest when net yield < 3%.

**36. Sale proceeds engine** — Itemized Belgian seller costs: brokerage 3%, prepayment penalty 1% (legally ≈ 3 months' interest), capital-gains tax 16.5% if < 5y, minus remaining loan → net proceeds. **Mortgage portability toggle**: porting the mortgage to the next purchase waives the prepayment penalty (shows the € saved + explanation of keeping the old rate).

**37. Hold vs Sell comparison** — Portfolio-level: hold = projection net worth; sell = net proceeds at year X compounded at the reinvestment rate; overlaid over 20 years.

**38. Property Simulator (future acquisition what-if)** — Full input model: price, renovation cost, initial value, years-until-purchase, appreciation, **Flemish registration tax with co-buying mode** (per-buyer share × rate, e.g. my 12% + partner's 2%), rent + indexation, all operating costs, loan (amount, rate, payment, term). Outputs: gross yield, year-1 net CF, +20y net-worth and cumulative-CF boost, three charts (baseline vs with-new, incremental delta) with "Buy" marker, snapshot table. State auto-saved (debounced) to Supabase.

**39. Growth Planner ("snowball" roadmap)** — Month-by-month simulation over a configurable horizon (default 25y, max LTV 80%): accumulates monthly household surplus + rental CF (minus 10% buffer), triggers each planned acquisition when accumulated cash covers down payment + acquisition costs (14% investment / 4% primary residence; 80% vs 90% LTV), creates the property + loan, records milestones (date, own funds used, new loan, payment, portfolio snapshot). Chart merges reconstructed history (de-appreciated values) with the simulated future.

**40. Belgian loan-type catalog + recommendation** — Reference data for 7 Belgian structures (standard mortgage, hypothecair mandaat, belofte van hypotheek, bullet loan, IPT + bullet, liquidatiereserve + bullet, personal loan) with 2024-25 rate ranges, LTV/term norms, pros/cons, and 2025 tax notes (woonbonus/interest-deduction abolition). Recommendation modal ranks them for passive income (bullet types ★5, interest-only ≈ 4–5× lower payment).

**41. Auto-generate acquisition plan** — Fills the growth plan with every achievable purchase in the horizon: two-pass simulation (find trigger months, then re-price each at indexed prices), rent as % of price, strategy toggle (balanced mortgage vs max-cash-flow bullet), interest-rate forecast model `rate(t) = 3.0% + 0.5% × e^(−ln2 · t/7)`.

**42. Acceleration advice engine** — Pure sensitivity analysis (no AI): re-runs the roadmap with one lever changed and reports months saved to first acquisition. Seven levers: release equity (80% LTV), +€200/+€500 monthly savings, switch to bullet loan, −5/−10% target price, +5y loan term, +10% rent, request 90% LTV for primary residence.

## F. Cross-cutting

**43. Portfolio sharing** — Generate a public read-only link (random token) with permission groups (dashboard / properties / financials / household); toggle, copy, revoke; shared portfolio page rendered from a `get_shared_portfolio` RPC (anon access).

**44. AI insights & chat** — Builds a financial-context prompt from the live portfolio (computeSummary + per-property data) with suggested property questions ("Can I afford to buy a new rental in 2 years?").

**45. Guest/demo mode + data claim** — Rows with NULL user_id are readable as demo data; on signup `claim_ownerless_data()` assigns them to the new account. RLS everywhere (child tables via parent-property join).

**46. Supabase data model** — Tables: `properties` (all fields above), `loans`, `amortization_schedules`, `planned_investments`, `household_profile` (+ members JSONB + ui_preferences), `simulator_profile` (JSONB state), `growth_planner_profile`, `share_tokens`. Service layer with camelCase↔snake_case mapping and batched portfolio load.

**47. Belgian tax calculation modules** — Standalone pure functions: rental withholding (30%) or KI-based tax (indexed KI × 1.4 × 50% marginal), capital gains / speculation tax (16.5% < 5 years, gain = sale − purchase), registration tax incl. **co-buying** per-owner rates (12% / 2%).

**48. Belgian locale & conventions** — nl-BE currency/date formatting everywhere; 80% LTV borrowing rule; health-index rent indexation; onroerende voorheffing fixed-tax convention; syndic terminology; EPC/renovation-obligation warnings.

---

## Known quirks (worth knowing before porting)

- **Interest vs capital doctrine is inconsistent by design**: Dashboard / Money Flow / projections treat only *interest* as a cost (capital = equity building); Cash Flow Aggregator and the scenario yield check subtract *full* loan payments.
- `vacancy_rate` NULL is mapped to `0` by the service but calculation fallbacks use `0.05` — a service-loaded 0 silently disables vacancy.
- `isPrimaryResidenceOn` in `propertyUtils.js` checks `occupancyStartDate/occupancyEndDate` while the schema uses `residence_start_date/residence_end_date` — likely a latent field-name mismatch.
- In `buildProjection`, operating costs are pro-rated by ownership fraction but loan payments are not.
- Growth advice lever 7 (higher LTV) references an undefined `maxLTV` variable — latent bug.
- PropertyTimeline's year financials apply rent indexation but **not** vacancy; the projection engine applies both.

## Default assumptions (single source of truth when porting)

| Constant | Value |
|---|---|
| Appreciation rate | 2%/yr |
| Rent indexation | 2%/yr (health index) |
| Cost inflation | 2%/yr (never on property tax) |
| Vacancy rate | 5% |
| Projection horizon | 20 years (21 points) |
| Growth planner horizon / LTV | 25 years / 80% (90% primary) |
| Acquisition costs | 14% investment / 4% primary |
| Registration tax | 12% standard / 2% enige eigen woning |
| Notary estimate | 1% of price + €1,500 |
| Brokerage on sale | 3% |
| Prepayment penalty | 1% (waived when porting mortgage) |
| Rental withholding | 30% |
| Capital gains (speculation) | 16.5% if sold < 5 years |
| Savings rate default | 10% |
| Mortgage rate default | 3.5% |
| Currency / locale | EUR / nl-BE |
