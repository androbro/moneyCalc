/**
 * mockData.js
 *
 * Static demo dataset shown to unauthenticated (guest) visitors.
 * This is a realistic Belgian property portfolio used purely for
 * demonstration purposes — no real Supabase data is exposed.
 */

// Stable IDs so the data is consistent across page loads
const PROP_A = 'mock-prop-antwerp'
const PROP_B = 'mock-prop-ghent'
const PROP_C = 'mock-prop-brussels'
const LOAN_A1 = 'mock-loan-a1'
const LOAN_B1 = 'mock-loan-b1'
const LOAN_C1 = 'mock-loan-c1'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(loanId, originalAmount, interestRate, termMonths, startDate) {
  const monthly = interestRate / 12
  const payment =
    monthly === 0
      ? originalAmount / termMonths
      : (originalAmount * monthly * Math.pow(1 + monthly, termMonths)) /
        (Math.pow(1 + monthly, termMonths) - 1)

  const schedule = []
  let balance = originalAmount
  const start = new Date(startDate)

  for (let p = 1; p <= termMonths; p++) {
    const dueDate = new Date(start)
    dueDate.setMonth(dueDate.getMonth() + p)
    const interest = balance * monthly
    const capital = payment - interest
    balance = Math.max(0, balance - capital)
    schedule.push({
      period: p,
      dueDate: dueDate.toISOString().slice(0, 10),
      capitalRepayment: Math.round(capital * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      totalPayment: Math.round(payment * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    })
  }
  return schedule
}

// ─── Mock portfolio ───────────────────────────────────────────────────────────

export function getMockPortfolio() {
  return {
    properties: [
      {
        id: PROP_A,
        name: 'Antwerp Studio',
        address: 'Meir 22, 2000 Antwerp',
        purchasePrice: 210000,
        currentValue: 248000,
        valuationDate: '2025-01-15',
        appreciationRate: 0.03,
        purchaseDate: '2019-06-01',
        registrationTax: 12600,
        notaryFees: 4200,
        agencyFees: 0,
        otherAcquisitionCosts: 1500,
        owners: [{ name: 'Demo User', share: 1 }],
        status: 'rented',
        isRented: true,
        rentalStartDate: '2019-09-01',
        rentalEndDate: '',
        isPrimaryResidence: false,
        residenceStartDate: '',
        residenceEndDate: '',
        startRentalIncome: 950,
        monthlyRentalIncome: 950,
        indexationRate: 0.02,
        monthlyExpenses: 120,
        annualMaintenanceCost: 800,
        annualInsuranceCost: 350,
        annualPropertyTax: 900,
        inflationRate: 0.02,
        vacancyRate: 0.04,
        loans: [
          {
            id: LOAN_A1,
            propertyId: PROP_A,
            lender: 'ING Belgium',
            originalAmount: 168000,
            interestRate: 0.0175,
            startDate: '2019-06-01',
            termMonths: 240,
            monthlyPayment: 963,
            amortizationSchedule: makeSchedule(LOAN_A1, 168000, 0.0175, 240, '2019-06-01'),
          },
        ],
        plannedInvestments: [
          {
            id: 'mock-inv-a1',
            propertyId: PROP_A,
            description: 'Kitchen renovation',
            plannedDate: '2027-03-01',
            cost: 14000,
            valueIncrease: 18000,
          },
        ],
      },
      {
        id: PROP_B,
        name: 'Ghent Townhouse',
        address: 'Korenlei 8, 9000 Ghent',
        purchasePrice: 385000,
        currentValue: 440000,
        valuationDate: '2025-01-15',
        appreciationRate: 0.025,
        purchaseDate: '2021-03-15',
        registrationTax: 23100,
        notaryFees: 7700,
        agencyFees: 7700,
        otherAcquisitionCosts: 2000,
        owners: [
          { name: 'Demo User', share: 0.5 },
          { name: 'Partner', share: 0.5 },
        ],
        status: 'owner_occupied',
        isRented: false,
        rentalStartDate: '',
        rentalEndDate: '',
        isPrimaryResidence: true,
        residenceStartDate: '2021-03-15',
        residenceEndDate: '',
        startRentalIncome: 0,
        monthlyRentalIncome: 0,
        indexationRate: 0.02,
        monthlyExpenses: 250,
        annualMaintenanceCost: 1500,
        annualInsuranceCost: 750,
        annualPropertyTax: 1800,
        inflationRate: 0.02,
        vacancyRate: 0,
        loans: [
          {
            id: LOAN_B1,
            propertyId: PROP_B,
            lender: 'BNP Paribas Fortis',
            originalAmount: 308000,
            interestRate: 0.0215,
            startDate: '2021-03-15',
            termMonths: 300,
            monthlyPayment: 1427,
            amortizationSchedule: makeSchedule(LOAN_B1, 308000, 0.0215, 300, '2021-03-15'),
          },
        ],
        plannedInvestments: [
          {
            id: 'mock-inv-b1',
            propertyId: PROP_B,
            description: 'Solar panel installation',
            plannedDate: '2026-06-01',
            cost: 9500,
            valueIncrease: 12000,
          },
          {
            id: 'mock-inv-b2',
            propertyId: PROP_B,
            description: 'Bathroom remodel',
            plannedDate: '2029-01-01',
            cost: 18000,
            valueIncrease: 22000,
          },
        ],
      },
      {
        id: PROP_C,
        name: 'Brussels Apartment',
        address: 'Avenue Louise 120, 1050 Brussels',
        purchasePrice: 320000,
        currentValue: 355000,
        valuationDate: '2025-01-15',
        appreciationRate: 0.02,
        purchaseDate: '2023-09-01',
        registrationTax: 19200,
        notaryFees: 6400,
        agencyFees: 6400,
        otherAcquisitionCosts: 1800,
        owners: [{ name: 'Demo User', share: 1 }],
        status: 'rented',
        isRented: true,
        rentalStartDate: '2023-11-01',
        rentalEndDate: '',
        isPrimaryResidence: false,
        residenceStartDate: '',
        residenceEndDate: '',
        startRentalIncome: 1400,
        monthlyRentalIncome: 1400,
        indexationRate: 0.02,
        monthlyExpenses: 180,
        annualMaintenanceCost: 1200,
        annualInsuranceCost: 550,
        annualPropertyTax: 1400,
        inflationRate: 0.02,
        vacancyRate: 0.05,
        loans: [
          {
            id: LOAN_C1,
            propertyId: PROP_C,
            lender: 'KBC',
            originalAmount: 256000,
            interestRate: 0.038,
            startDate: '2023-09-01',
            termMonths: 240,
            monthlyPayment: 1552,
            amortizationSchedule: makeSchedule(LOAN_C1, 256000, 0.038, 240, '2023-09-01'),
          },
        ],
        plannedInvestments: [],
      },
    ],
    meta: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      currency: 'EUR',
    },
  }
}

// ─── Mock household profile ───────────────────────────────────────────────────

export function getMockHousehold() {
  return {
    members: [
      {
        id: 'mock-member-me',
        name: 'Demo User',
        netIncome: 3800,
        investmentIncome: 200,
        cash: 45000,
      },
      {
        id: 'mock-member-partner',
        name: 'Partner',
        netIncome: 3200,
        investmentIncome: 0,
        cash: 20000,
      },
    ],
    householdExpenses: 3200,
    personalSavingsRate: 0.15,
  }
}

// ─── Mock simulator profile ───────────────────────────────────────────────────

export function getMockSimulatorProfile() {
  return {}
}
