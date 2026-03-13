/**
 * Belgian Mortgage and Loan Types
 *
 * Static reference data for the Growth Planner Belgian Loan Guide.
 * Based on market research (2024–2025 rates and Belgian tax law).
 *
 * CRITICAL TAX NOTE (2025):
 * Mortgage interest deduction abolished for all non-primary-residence
 * properties as of 01/01/2025. Only IPT premiums remain tax-deductible
 * (at company level for self-employed / directors).
 */

export const BELGIAN_LOAN_TYPES = [
  {
    id: 'hypothecaire_lening',
    nameNL: 'Hypothecaire Lening',
    nameEN: 'Standard Mortgage',
    rateRange: { min: 0.030, max: 0.035 },
    rateLabel: '3.0–3.5%',
    security: 'registered_mortgage',
    registrationCost: 'high',
    taxDeductible: false,
    bestFor: ['primary_residence', 'rental_investment'],
    monthlyPaymentStyle: 'annuity',
    riskProfile: 'low',
    summaryEN:
      'Most common Belgian mortgage. Registered as a lien on the property via a notarial act. Higher upfront registration costs but lowest interest rates available.',
    prosEN: [
      'Lowest interest rates (3.0–3.5%)',
      'Most lenders offer this — maximum competition',
      'Fixed monthly annuity payment provides certainty',
      'Full capital repayment built into schedule',
    ],
    consEN: [
      'High upfront registration costs (~1% of loan amount)',
      'No mortgage interest deduction for investment properties post-2025',
      'Full notarial process required (slower to arrange)',
    ],
    taxNote2025:
      'Woonbonus abolished. No interest deduction for non-primary-residence properties from 01/01/2025.',
    typicalLTV: 0.80,
    typicalTermYears: 20,
    color: 'brand',
  },
  {
    id: 'hypothecair_mandaat',
    nameNL: 'Hypothecair Mandaat',
    nameEN: 'Mortgage Mandate',
    rateRange: { min: 0.035, max: 0.040 },
    rateLabel: '3.5–4.0%',
    security: 'mandate',
    registrationCost: 'low',
    taxDeductible: false,
    bestFor: ['rental_investment', 'bridge_financing'],
    monthlyPaymentStyle: 'annuity',
    riskProfile: 'medium',
    summaryEN:
      'You grant the bank an authentic power of attorney to register a mortgage at any time. Lower upfront costs since no registration is made immediately — but the bank can invoke it without notice.',
    prosEN: [
      'Significantly lower upfront costs vs standard mortgage (~€5k less on a €200k loan)',
      'Faster to arrange — no registration needed initially',
      'Property appears "unencumbered" in public records',
    ],
    consEN: [
      'Higher rate (3.5–4.0%) than standard mortgage',
      'Bank can activate the mortgage at any time without warning',
      'No interest deduction for investment properties post-2025',
      'Less consumer certainty than registered mortgage',
    ],
    taxNote2025:
      'Same rules as hypothecaire lening — no deduction for investment property interest post-2025.',
    typicalLTV: 0.80,
    typicalTermYears: 20,
    color: 'amber',
  },
  {
    id: 'belofte_van_hypotheek',
    nameNL: 'Belofte van Hypotheek',
    nameEN: 'Mortgage Promise',
    rateRange: { min: 0.040, max: 0.050 },
    rateLabel: '4.0–5.0%',
    security: 'promise',
    registrationCost: 'none',
    taxDeductible: false,
    bestFor: [],
    monthlyPaymentStyle: 'annuity',
    riskProfile: 'high',
    summaryEN:
      'A promise (not enforceable in court) to register a mortgage if the bank requests it. Weakest security form. Rarely accepted by lenders in practice.',
    prosEN: [
      'No notarial registration costs',
      'Fastest and cheapest to arrange on paper',
    ],
    consEN: [
      'Weakest legal security — bank cannot enforce the promise in court',
      'Highest interest rate to compensate for uncertainty',
      'Very few lenders accept this as sole collateral',
      'No tax deduction for investment properties',
    ],
    taxNote2025: 'No deduction for investment property interest post-2025.',
    typicalLTV: 0.70,
    typicalTermYears: 20,
    color: 'red',
  },
  {
    id: 'bullet_loan',
    nameNL: 'Bulletkrediet',
    nameEN: 'Bullet Loan',
    rateRange: { min: 0.035, max: 0.045 },
    rateLabel: '3.5–4.5%',
    security: 'registered_mortgage',
    registrationCost: 'high',
    taxDeductible: false,
    bestFor: ['rental_investment', 'high_cashflow_needed'],
    monthlyPaymentStyle: 'interest_only',
    riskProfile: 'medium',
    summaryEN:
      'You pay only interest during the term. The full principal is repaid in a single lump sum at maturity. Monthly payments are 4–5× lower than an annuity loan. Requires a credible exit plan (property sale, pension, reserves).',
    prosEN: [
      'Monthly payments 4–5× lower than annuity — maximises rental cash flow',
      'Capital preserved and available throughout the term',
      'Ideal for properties where rental income covers interest easily',
      'Balloon can be repaid via property sale at end of term',
    ],
    consEN: [
      'Total interest paid over full term is higher than annuity',
      'Requires a credible exit strategy for capital repayment',
      'Lenders require proof of repayment capacity at maturity',
      'No tax deduction for investment properties post-2025',
    ],
    taxNote2025:
      'Interest paid on bullet loans is not deductible for investment properties from 01/01/2025.',
    typicalLTV: 0.75,
    typicalTermYears: 10,
    color: 'emerald',
  },
  {
    id: 'ipt_bullet',
    nameNL: 'IPT + Bulletkrediet',
    nameEN: 'Individual Pension + Bullet',
    rateRange: { min: 0.035, max: 0.045 },
    rateLabel: '3.5–4.5%',
    security: 'registered_mortgage',
    registrationCost: 'high',
    taxDeductible: true,
    bestFor: ['self_employed', 'company_directors'],
    monthlyPaymentStyle: 'interest_only',
    riskProfile: 'low',
    summaryEN:
      'A bullet loan whose capital repayment is covered at maturity by an IPT (Individuele Pensioentoezegging) pension plan. For self-employed professionals and company directors only. IPT premiums are fully tax-deductible at company level — one of the last remaining highly tax-efficient real estate strategies post-2025.',
    prosEN: [
      'IPT premiums are 100% tax-deductible as a company cost (satisfying the 80% rule)',
      'Pension capital repays bullet at maturity — no forced property sale',
      'Monthly payments are interest-only (very low)',
      'Combines real estate wealth with retirement savings',
      'Pension capital typically earns guaranteed return (Branch 21)',
    ],
    consEN: [
      'Only available to self-employed / company directors with an IPT mandate',
      'Must satisfy the "80% rule" — total pension ≤ 80% of last gross annual salary',
      'Complex to structure — requires professional financial advisor',
      'IPT capital locked until pension age (60–67)',
    ],
    taxNote2025:
      'IPT/group insurance premiums remain deductible as company expenses. One of the last highly tax-efficient Belgian real estate strategies after the 2025 woonbonus abolition.',
    typicalLTV: 0.75,
    typicalTermYears: 15,
    color: 'violet',
  },
  {
    id: 'liquidatiereserve_bullet',
    nameNL: 'Liquidatiereserve + Bulletkrediet',
    nameEN: 'Liquidation Reserve + Bullet',
    rateRange: { min: 0.035, max: 0.045 },
    rateLabel: '3.5–4.5%',
    security: 'registered_mortgage',
    registrationCost: 'high',
    taxDeductible: false,
    bestFor: ['company_owners'],
    monthlyPaymentStyle: 'interest_only',
    riskProfile: 'medium',
    summaryEN:
      'A Belgian company builds up a liquidation reserve (taxed at only 5% upon company liquidation vs 30% dividend withholding tax). The reserve then repays the bullet loan at maturity. For company owners with retained earnings.',
    prosEN: [
      'Liquidation reserve taxed at only 5% vs 30% dividend withholding tax',
      'Efficiently monetises retained company earnings',
      'Interest-only payments maximise current cash flow',
      'Avoids high personal dividend taxation',
    ],
    consEN: [
      'Only applicable to Belgian companies with sufficient reserves',
      'Reserve must be held for at least 5 years before qualifying for 5% rate',
      'Requires tax and legal advice to structure correctly',
      'Company liquidity partially tied up in reserve',
    ],
    taxNote2025:
      'Liquidation reserve regime (VVPRbis / liquidatiereserve) remains intact. 5% tax at liquidation vs 30% roerende voorheffing on dividends — significant advantage for company owners.',
    typicalLTV: 0.75,
    typicalTermYears: 10,
    color: 'cyan',
  },
  {
    id: 'persoonlijke_lening',
    nameNL: 'Persoonlijke Lening',
    nameEN: 'Personal Loan',
    rateRange: { min: 0.050, max: 0.080 },
    rateLabel: '5–8%',
    security: 'none',
    registrationCost: 'none',
    taxDeductible: false,
    bestFor: ['small_gap_financing', 'acquisition_costs'],
    monthlyPaymentStyle: 'annuity',
    riskProfile: 'high',
    summaryEN:
      'Unsecured personal loan. Maximum ~€75,000. High interest rate. Only practical as a top-up when you are slightly short on the down payment — not a primary real estate financing tool.',
    prosEN: [
      'No collateral required',
      'Fast approval (days not weeks)',
      'Can bridge a small gap in the down payment',
    ],
    consEN: [
      'Highest interest rate (5–8%) — significantly increases total cost',
      'Maximum loan amount ~€75,000',
      'Banks count this payment in your mortgage affordability assessment',
      'Increases total debt-to-income ratio — may reduce mortgage capacity',
      'No tax deduction',
    ],
    taxNote2025: 'No tax deduction. Also negatively impacts mortgage affordability calculations.',
    typicalLTV: null,
    typicalTermYears: 5,
    color: 'rose',
  },
]

/**
 * Look up a loan type by id.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getLoanType(id) {
  return BELGIAN_LOAN_TYPES.find((t) => t.id === id)
}

/**
 * Get loan types suitable for a given use case.
 * @param {'primary_residence'|'rental_investment'|'self_employed'|'company_owners'|'high_cashflow_needed'} useCase
 * @returns {Object[]}
 */
export function getLoanTypesForUseCase(useCase) {
  return BELGIAN_LOAN_TYPES.filter((t) => t.bestFor.includes(useCase))
}
