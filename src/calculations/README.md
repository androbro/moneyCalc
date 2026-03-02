# Calculations Module

This folder contains all financial calculation logic for the MoneyCalc real estate portfolio tracker, organized following SOLID principles and separation of concerns.

## Overview

MoneyCalc is a Belgian real estate portfolio management application that provides:
- 20-year financial projections
- Belgian tax calculations (rental income, capital gains, investments)
- Property acquisition simulation
- Scenario analysis (hold vs sell)
- Cash flow modeling

## Folder Structure

```
calculations/
├── loans/              # Loan balance and payment calculations
│   ├── loanBalance.js      # Remaining balance using annuity formula or amortization schedule
│   ├── loanPayments.js     # Annual payments and interest/capital splits
│   └── index.js            # Module exports
│
├── taxes/              # Belgian tax calculations
│   ├── rentalIncomeTax.js      # 30% withholding or personal declaration
│   ├── capitalGainsTax.js      # 16.5% speculation tax (< 5 years)
│   ├── investmentTax.js        # ETF (0% gains, 30% dividends), bonds, savings
│   ├── registrationTax.js      # 12% standard, 2% reduced (enige eigen woning)
│   └── index.js                # Module exports
│
├── projections/        # Portfolio projection calculations
│   ├── portfolioProjection.js  # 20-year net worth and cash flow projections
│   ├── dashboardSummary.js     # Current portfolio KPIs (ROE, LTV, etc.)
│   └── index.js                # Module exports
│
├── scenarios/          # Scenario analysis
│   ├── saleProceeds.js         # Net proceeds from property sales
│   ├── holdVsSell.js           # Hold vs sell and reinvest comparison
│   ├── propertyScenarios.js    # Property-by-property decisions
│   ├── propertySimulator.js    # Future property acquisition simulation
│   └── index.js                # Module exports
│
├── utils/              # Utility functions
│   ├── dateUtils.js            # Date manipulation (monthsBetween, addYears, etc.)
│   └── propertyUtils.js        # Property status checks (isRentalActiveOn, etc.)
│
├── formatters/         # Display formatters
│   └── index.js                # Currency and percentage formatting (Belgian locale)
│
└── index.js            # Main module export (import from here)
```

## Usage

### Basic Import

```javascript
// Import specific functions
import { 
  buildProjection, 
  computeSummary,
  getRemainingBalance 
} from '@/calculations'

// Or import from specific modules
import { buildProjection } from '@/calculations/projections'
import { calculateCapitalGainsTax } from '@/calculations/taxes'
```

### Example: Calculate Portfolio Projection

```javascript
import { buildProjection } from '@/calculations'

const properties = [
  {
    id: 1,
    currentValue: 250000,
    appreciationRate: 0.02,
    monthlyRentalIncome: 1200,
    indexationRate: 0.02,
    vacancyRate: 0.05,
    loans: [
      {
        originalAmount: 200000,
        interestRate: 0.03,
        termMonths: 240,
        startDate: '2023-01-01',
        monthlyPayment: 1108
      }
    ]
  }
]

const projection = buildProjection(properties)
// Returns 21 data points (year 0-20) with netWorth, cashFlow, etc.
```

### Example: Calculate Belgian Capital Gains Tax

```javascript
import { calculateCapitalGainsTax } from '@/calculations'

const result = calculateCapitalGainsTax(
  250000,  // purchase price
  300000,  // sale value
  new Date('2022-01-01'),  // purchase date
  new Date('2024-01-01'),  // sale date
  { capitalGainsRate: 0.165 }
)

// Result: { capitalGain: 50000, tax: 8250, taxApplies: true, yearsSincePurchase: 2 }
```

## Key Calculation Domains

### 1. Loan Calculations (`loans/`)

**Core formulas:**
- Annuity remaining balance: `balance = P × [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]`
- Monthly interest: `balance × (rate / 12)`
- Monthly capital: `monthlyPayment - monthlyInterest`

**Functions:**
- `getRemainingBalance(loan, date)` - Current loan balance
- `getAnnualLoanPayment(loan, year)` - Total payments in a year window
- `getLoanPaymentSplit(loan, date)` - Interest vs capital breakdown

### 2. Belgian Tax Calculations (`taxes/`)

#### Rental Income Tax
- **Withholding regime:** 30% simplified (roerende voorheffing)
- **Personal declaration:** Marginal rate (varies by income)

```javascript
calculateRentalIncomeTax(12000, { useWithholding: true })
// Returns: 8400 (after 30% withholding)
```

#### Capital Gains Tax
- **Rate:** 16.5% on capital gains
- **Applies:** Only if sold within 5 years of purchase
- **Exempt:** Primary residence (enige eigen woning)

```javascript
calculateCapitalGainsTax(200000, 250000, purchaseDate, saleDate)
```

#### Investment Tax
- **ETFs:** 0% capital gains, 30% on dividends
- **Bonds:** 30% withholding on interest
- **Savings:** 15% tax above €1020 exemption

#### Registration Tax
- **Standard:** 12% (Flanders), 12.5% (Brussels/Wallonia)
- **Reduced:** 2% for enige eigen woning (conditions apply)
- **Co-buying:** Each owner's share taxed at their applicable rate

### 3. Portfolio Projections (`projections/`)

**20-year projection includes:**
- Property value appreciation: `value × (1 + appreciationRate)^year`
- Indexed rental income: `rent × (1 + indexationRate)^year × (1 - vacancyRate)`
- Indexed costs: `cost × (1 + inflationRate)^year`
- Loan balances and payments
- Planned investments (value bumps)
- Cumulative cash flow
- Total return (equity + cash flow)

**Functions:**
- `buildProjection(properties)` - 20-year projection
- `computeSummary(properties, profile)` - Current snapshot (ROE, LTV, net worth)

### 4. Scenario Analysis (`scenarios/`)

#### Sale Proceeds
Belgian seller costs:
- Brokerage: 3%
- Prepayment penalty: ~1% (capped at 3 months' interest)
- Capital gains tax: 16.5% (if < 5 years)
- Mortgage portability: Avoid prepayment penalty when buying new property

#### Hold vs Sell
Compare:
- **Hold:** Continue ownership with appreciation
- **Sell & Reinvest:** Sell at year X, compound at reinvestment rate

#### Property-by-Property Scenarios
Per-property actions:
- **Keep:** Continue renting
- **Sell:** Liquidate and reinvest (ETF/bonds/savings)
- **Occupy:** Move in as primary residence

#### Future Property Simulator
Model acquisition of new property:
- Acquisition costs (price + registration tax + renovation)
- Impact on net worth and cash flow
- Baseline vs "with new property" comparison

## Design Principles

### 1. Separation of Concerns
Each module has a single responsibility:
- `loans/` - Only loan calculations
- `taxes/` - Only tax calculations
- `projections/` - Only projection logic
- `scenarios/` - Only scenario analysis

### 2. Pure Functions
All calculation functions are pure:
- No side effects
- Same input always produces same output
- Fully testable

### 3. Single Responsibility Principle
Each function does one thing:
- `getRemainingBalance()` - Only calculates balance
- `calculateCapitalGainsTax()` - Only calculates tax
- `buildProjection()` - Orchestrates but delegates to specialized functions

### 4. Dependency Inversion
Higher-level modules depend on abstractions:
- `buildProjection()` uses `getRemainingBalance()` without knowing implementation
- Functions accept configuration objects for flexibility

### 5. Open/Closed Principle
Functions are open for extension, closed for modification:
- Tax rates passed as config objects
- New scenarios can be added without modifying existing code

## Belgian-Specific Rules

### Rental Income
- **Withholding:** 30% simplified regime
- **KI-based:** Tax on indexed cadastral income (KI × 1.4 × marginal rate)
- **Indexation:** Legally indexed to health index (~2% annually)

### Capital Gains
- **Speculation tax:** 16.5% if sold < 5 years
- **Exemptions:** Primary residence, inherited property
- **Calculation base:** Sale value - purchase price

### Registration Tax
- **Standard:** 12% (Flanders as of 2024)
- **Reduced:** 2% for enige eigen woning (sole primary residence)
- **Conditions:** Must be principal residence, not own other property, income limits

### Mortgage Features
- **Prepayment penalty:** Max 3 months' interest
- **Portability:** Transfer mortgage to new property without penalty
- **Interest deductibility:** Not applicable for rental properties (post-2005 rule)

### Investment Taxation
- **ETF:** 0% capital gains (no TOB on redemption), 30% on dividends
- **Bonds:** 30% withholding on interest
- **Savings:** First €1020 exempt, then 15% tax

## Testing

Each calculation module should be tested independently:

```javascript
// Example test
import { getRemainingBalance } from '@/calculations/loans'

test('calculates remaining balance correctly', () => {
  const loan = {
    originalAmount: 100000,
    interestRate: 0.03,
    termMonths: 240,
    startDate: '2020-01-01',
    monthlyPayment: 554
  }
  
  const balance = getRemainingBalance(loan, '2025-01-01')
  expect(balance).toBeCloseTo(70000, -2)
})
```

## Migration Notes

The original `src/utils/projectionUtils.js` (929 lines) has been refactored into this modular structure. The old file now serves as a compatibility layer that re-exports from the new modules.

**Old imports (still work):**
```javascript
import { buildProjection } from '@/utils/projectionUtils'
```

**New imports (recommended):**
```javascript
import { buildProjection } from '@/calculations'
```

## Future Enhancements

Potential additions:
- `insurance/` - Insurance premium calculations
- `mortgage/` - Mortgage refinancing analysis
- `amortization/` - Amortization schedule generation
- `cashflow/` - Household budget integration
- `optimization/` - Portfolio optimization algorithms

## Contributing

When adding new calculations:

1. **Choose the right module:** Place calculation in appropriate domain folder
2. **Keep functions pure:** No side effects, no external dependencies
3. **Document thoroughly:** Include JSDoc comments with examples
4. **Add tests:** Unit test each function independently
5. **Export properly:** Update module index.js and main index.js
6. **Follow naming conventions:** Use clear, descriptive function names

## License

Part of the MoneyCalc real estate portfolio tracker.
