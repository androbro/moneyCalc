# Calculation Files Summary

## Overview

All calculation logic has been extracted from the monolithic `projectionUtils.js` (929 lines) and organized into focused, single-responsibility modules totaling ~1400 lines across 20 files.

## File Organization

### 📁 src/calculations/

```
calculations/
│
├── 📄 index.js (80 lines)
│   Main export - import all calculations from here
│
├── 📂 loans/ (3 files, ~180 lines)
│   ├── loanBalance.js        - Remaining balance calculations (annuity formula, schedules)
│   ├── loanPayments.js       - Annual payments and interest/capital splits
│   └── index.js              - Module exports
│
├── 📂 taxes/ (5 files, ~250 lines)
│   ├── rentalIncomeTax.js    - Belgian rental income tax (30% withholding, KI-based)
│   ├── capitalGainsTax.js    - Capital gains / speculation tax (16.5% < 5 years)
│   ├── investmentTax.js      - ETF, bonds, savings taxation
│   ├── registrationTax.js    - Property purchase tax (12% standard, 2% reduced)
│   └── index.js              - Module exports
│
├── 📂 projections/ (3 files, ~240 lines)
│   ├── portfolioProjection.js - 20-year projection engine
│   ├── dashboardSummary.js    - Current portfolio KPIs (ROE, LTV, cash flow)
│   └── index.js               - Module exports
│
├── 📂 scenarios/ (5 files, ~450 lines)
│   ├── saleProceeds.js        - Net proceeds from property sales
│   ├── holdVsSell.js          - Hold vs sell & reinvest comparison
│   ├── propertyScenarios.js   - Property-by-property decision analysis
│   ├── propertySimulator.js   - Future property acquisition simulator
│   └── index.js               - Module exports
│
├── 📂 utils/ (2 files, ~90 lines)
│   ├── dateUtils.js           - Date manipulation utilities
│   └── propertyUtils.js       - Property status and ownership utilities
│
├── 📂 formatters/ (1 file, ~40 lines)
│   └── index.js               - Currency and percentage formatting (Belgian locale)
│
└── 📄 README.md (~460 lines)
    Comprehensive documentation of all calculations

```

## Key Files for AI Review

When sharing with AI for validation, include these core files:

### 1. Loan Calculations
- `calculations/loans/loanBalance.js` - Core annuity formula
- `calculations/loans/loanPayments.js` - Payment splitting logic

### 2. Tax Calculations (Belgian-specific)
- `calculations/taxes/rentalIncomeTax.js` - 30% withholding
- `calculations/taxes/capitalGainsTax.js` - 16.5% speculation tax
- `calculations/taxes/investmentTax.js` - ETF/bonds/savings
- `calculations/taxes/registrationTax.js` - 12% standard, 2% reduced

### 3. Projection Engine
- `calculations/projections/portfolioProjection.js` - 20-year projection
- `calculations/projections/dashboardSummary.js` - Current KPIs

### 4. Scenario Analysis
- `calculations/scenarios/saleProceeds.js` - Sale transaction costs
- `calculations/scenarios/propertyScenarios.js` - Keep/sell/occupy decisions
- `calculations/scenarios/propertySimulator.js` - Future acquisition modeling

### 5. Supporting Utilities
- `calculations/utils/dateUtils.js` - Date helpers
- `calculations/utils/propertyUtils.js` - Property status checks

## Design Improvements

### Before (Single File)
```
src/utils/projectionUtils.js  (929 lines)
├── Loan calculations
├── Tax calculations
├── Projections
├── Scenarios
├── Utilities
└── Formatters
```

### After (Modular Structure)
```
src/calculations/              (20 files, ~1400 lines)
├── loans/                     (Single responsibility: Loan math)
├── taxes/                     (Single responsibility: Belgian tax rules)
├── projections/               (Single responsibility: Portfolio projections)
├── scenarios/                 (Single responsibility: Scenario analysis)
├── utils/                     (Single responsibility: Helper functions)
└── formatters/                (Single responsibility: Display formatting)
```

## SOLID Principles Applied

### 1. Single Responsibility Principle
Each file has ONE reason to change:
- `loanBalance.js` - Only changes if loan calculation formula changes
- `capitalGainsTax.js` - Only changes if Belgian tax law changes
- `portfolioProjection.js` - Only changes if projection logic changes

### 2. Open/Closed Principle
Functions accept configuration objects for extension:
```javascript
calculateCapitalGainsTax(price, value, dates, { capitalGainsRate: 0.165 })
// Can easily change rate without modifying function
```

### 3. Dependency Inversion
Higher-level functions depend on abstractions:
```javascript
buildProjection(properties)
  └── calls getRemainingBalance(loan, date)
      └── implementation detail hidden
```

### 4. Separation of Concerns
Clear boundaries between domains:
- **Loans:** Pure math (interest, balance, payments)
- **Taxes:** Belgian tax rules (rental, capital gains, investments)
- **Projections:** Time-series calculations (20-year view)
- **Scenarios:** What-if analysis (hold vs sell, simulate new property)

## Import Examples

### Old Way (Legacy Compatibility)
```javascript
import { buildProjection } from '@/utils/projectionUtils'
```

### New Way (Recommended)
```javascript
// Import from main index
import { buildProjection, computeSummary } from '@/calculations'

// Or import from specific modules
import { buildProjection } from '@/calculations/projections'
import { calculateCapitalGainsTax } from '@/calculations/taxes'
import { getRemainingBalance } from '@/calculations/loans'
```

## Benefits

### For AI Review
1. **Focused Context:** Each file is small and focused (30-150 lines)
2. **Clear Purpose:** File name indicates exactly what it calculates
3. **Easy to Validate:** Can review one domain at a time
4. **Well Documented:** Each function has JSDoc comments

### For Development
1. **Easy to Test:** Pure functions, no side effects
2. **Easy to Maintain:** Changes are localized to specific files
3. **Easy to Extend:** Add new calculations without touching existing code
4. **Easy to Understand:** Clear organization, single responsibility

### For Code Review
1. **Small Diffs:** Changes affect only relevant files
2. **Clear Intent:** File structure shows what changed
3. **Reduced Conflicts:** Multiple developers can work on different domains

## Belgian Tax Rules Reference

Quick reference for AI validation:

| Tax Type | Rate | Conditions |
|----------|------|------------|
| Rental Income | 30% | Withholding regime (roerende voorheffing) |
| Capital Gains | 16.5% | If sold < 5 years (speculation tax) |
| Registration | 12% | Standard (Flanders) |
| Registration | 2% | Reduced (enige eigen woning) |
| ETF Capital Gains | 0% | No taxation on appreciation |
| ETF Dividends | 30% | Withholding on distributions |
| Bonds Interest | 30% | Withholding |
| Savings Interest | 15% | Above €1020 exemption |

## Next Steps

1. ✅ All calculations extracted and organized
2. ✅ Legacy compatibility layer created
3. ✅ Comprehensive documentation written
4. ⏳ Test with `npm run build` to verify no import errors
5. ⏳ Share `src/calculations/` folder with AI for validation

## Sharing with AI

To validate calculations with AI, provide:

1. **This summary file** - Overview and context
2. **README.md** - Detailed documentation
3. **Individual calculation files** - One domain at a time:
   - Start with `loans/` (foundational)
   - Then `taxes/` (Belgian rules)
   - Then `projections/` (uses loans + taxes)
   - Then `scenarios/` (uses everything)

AI can now easily review each domain independently without overwhelming context!
