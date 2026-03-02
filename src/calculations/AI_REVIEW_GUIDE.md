# AI Review Guide - Calculation Files

## Quick Start for AI Validation

This folder contains all financial calculation logic for MoneyCalc, a Belgian real estate portfolio tracker.

### What to Review

All calculations are now in **`src/calculations/`** organized by domain:

1. **Loans** - Mortgage balance and payment calculations
2. **Taxes** - Belgian tax rules (rental income, capital gains, investments)
3. **Projections** - 20-year portfolio forecasting
4. **Scenarios** - What-if analysis (hold vs sell, future purchases)

### How to Share with AI

#### Option 1: Review Individual Domains

Share one folder at a time:

```bash
# 1. Start with loans (foundational)
src/calculations/loans/

# 2. Then taxes (Belgian specific)
src/calculations/taxes/

# 3. Then projections (uses loans + taxes)
src/calculations/projections/

# 4. Finally scenarios (uses everything)
src/calculations/scenarios/
```

#### Option 2: Review Specific Calculations

Pick the calculations you want validated:

**Loan Math:**
- `loans/loanBalance.js` - Annuity formula: `balance = P × [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]`

**Belgian Tax Rules:**
- `taxes/rentalIncomeTax.js` - 30% withholding regime
- `taxes/capitalGainsTax.js` - 16.5% speculation tax (< 5 years)
- `taxes/registrationTax.js` - 12% standard, 2% reduced (enige eigen woning)

**Portfolio Projections:**
- `projections/portfolioProjection.js` - 20-year net worth projection

**Scenario Analysis:**
- `scenarios/propertyScenarios.js` - Keep/sell/occupy decision modeling

### Context for AI

**What this app does:**
- Tracks Belgian real estate investment portfolios
- Projects 20-year net worth and cash flow
- Applies Belgian tax rules (rental income, capital gains, registration)
- Simulates scenarios (sell property, buy new property, hold vs sell)

**Key Belgian Tax Rules:**
- Rental income: 30% withholding or personal declaration
- Capital gains: 16.5% if sold within 5 years
- Registration tax: 12% standard, 2% for sole primary residence
- ETF: 0% on capital gains, 30% on dividends

**Formulas to Validate:**
1. Annuity remaining balance (loan balance over time)
2. Indexed rental income with vacancy rate
3. Indexed operating costs with inflation
4. Capital gains tax calculation
5. Net sale proceeds after all costs

### Questions for AI

When reviewing, ask AI to check:

1. **Mathematical Correctness**
   - Is the annuity formula implemented correctly?
   - Are compound growth calculations correct?
   - Do percentages convert properly (0.02 = 2%)?

2. **Belgian Tax Accuracy**
   - Is 16.5% capital gains tax applied correctly (< 5 years)?
   - Is 30% rental withholding calculated properly?
   - Are registration tax rates correct (12% standard, 2% reduced)?

3. **Logic Errors**
   - Are edge cases handled (zero balance, no loans, etc.)?
   - Do date calculations work correctly?
   - Are vacancy rates applied to the right values?

4. **Code Quality**
   - Are functions pure (no side effects)?
   - Are variables named clearly?
   - Is error handling adequate?

### Example Prompt for AI

```
I have a Belgian real estate portfolio calculator. Can you review these calculation files?

Focus on:
1. Mathematical correctness of the annuity formula
2. Accuracy of Belgian tax rules (16.5% speculation tax, 30% withholding)
3. Logic errors or edge cases I might have missed

[Attach files from src/calculations/]
```

### File Size Reference

Each file is small and focused (30-150 lines):

| Domain | Files | Total Lines | Review Priority |
|--------|-------|-------------|-----------------|
| loans/ | 3 | ~180 | HIGH (foundational) |
| taxes/ | 5 | ~250 | HIGH (Belgian specific) |
| projections/ | 3 | ~240 | MEDIUM (orchestration) |
| scenarios/ | 5 | ~450 | MEDIUM (what-if analysis) |
| utils/ | 2 | ~90 | LOW (helpers) |

### Success Criteria

AI should confirm:
- ✅ Annuity formula matches standard mortgage math
- ✅ Belgian tax rates and rules are accurate
- ✅ Compound growth calculations are correct
- ✅ Edge cases are handled properly
- ✅ No obvious logic errors

### Common Issues to Check

1. **Date calculations:** Are months counted correctly?
2. **Percentage conversions:** Is 0.02 treated as 2%?
3. **Rounding:** Are values rounded appropriately?
4. **Vacancy rate:** Applied to gross rent, not net rent?
5. **Capital gains:** Only applies if < 5 years?
6. **Loan balance:** Decreases over time correctly?

---

**Ready to share!** All files are in `src/calculations/` and are well-documented with JSDoc comments.
