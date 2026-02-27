# MoneyCalc — Real Estate Portfolio Tracker

A responsive React application to visualize and project your real estate portfolio over time.
Data is stored in the browser's **localStorage** with a structure designed for future migration to **Supabase**.

---

## MVP — Minimum Viable Product

### Goal

Keep a clear overview of real estate assets, loans, and cash flow — on both mobile and desktop — without requiring a backend.

### Features

| Feature | Description |
|---|---|
| Add Properties | Create and manage multiple real estate properties with address, purchase price, current value, and appreciation rate |
| Link Loans | Attach one or more loans to each property (lender, start date, original amount, interest rate) |
| Upload Amortization Schedules | Import a KBC-style CSV file per loan to get precise monthly capital/interest breakdown |
| Dashboard | Key metrics at a glance: Total Net Worth, Total Monthly Cash Flow, total assets, total liabilities |
| Net Worth Projection Chart | A 20-year recharts area chart showing property value growth vs. remaining loan balance |

---

## Technology Stack

| Layer | Choice |
|---|---|
| Build tool | Vite |
| UI framework | React 18 |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Storage (MVP) | Browser localStorage |
| Storage (future) | Supabase (PostgreSQL + Row-Level Security) |

---

## Data Structure (localStorage)

All data lives under the key **`moneyCalc_portfolio`** as a single JSON object.

```json
{
  "properties": [
    {
      "id": "prop_uuid_1",
      "name": "Apartment Brussels",
      "address": "Rue de la Loi 1, 1000 Brussels",
      "purchasePrice": 275000,
      "currentValue": 285000,
      "appreciationRate": 0.02,
      "monthlyRentalIncome": 1200,
      "monthlyExpenses": 150,
      "purchaseDate": "2022-03-01",
      "loans": [
        {
          "id": "loan_uuid_1",
          "propertyId": "prop_uuid_1",
          "lender": "KBC",
          "originalAmount": 230000,
          "interestRate": 0.0195,
          "startDate": "2022-04-01",
          "termMonths": 240,
          "monthlyPayment": 1156.23,
          "amortizationSchedule": [
            {
              "period": 1,
              "dueDate": "2022-05-01",
              "capitalRepayment": 782.90,
              "interest": 373.33,
              "totalPayment": 1156.23,
              "remainingBalance": 229217.10
            },
            {
              "period": 2,
              "dueDate": "2022-06-01",
              "capitalRepayment": 784.17,
              "interest": 372.06,
              "totalPayment": 1156.23,
              "remainingBalance": 228432.93
            }
          ]
        }
      ]
    }
  ],
  "meta": {
    "version": "1.0.0",
    "lastUpdated": "2026-02-27T00:00:00.000Z",
    "currency": "EUR"
  }
}
```

### Entity Descriptions

**Property**
- `id` — UUID, primary key
- `name` — human-readable label
- `address` — full address string
- `purchasePrice` — price paid at acquisition (EUR)
- `currentValue` — manually-set current market value (EUR)
- `appreciationRate` — annual percentage (e.g. `0.02` = 2%)
- `monthlyRentalIncome` — gross monthly rent (EUR)
- `monthlyExpenses` — recurring costs: insurance, maintenance, syndic, etc. (EUR)
- `purchaseDate` — ISO date string
- `loans` — array of Loan objects linked to this property

**Loan**
- `id` — UUID, primary key
- `propertyId` — foreign key to parent Property
- `lender` — bank name (e.g. "KBC", "BNP Paribas Fortis")
- `originalAmount` — initial loan principal (EUR)
- `interestRate` — annual nominal rate (e.g. `0.0195` = 1.95%)
- `startDate` — ISO date string of first repayment
- `termMonths` — total duration in months
- `monthlyPayment` — fixed monthly annuity (EUR)
- `amortizationSchedule` — array of AmortizationEntry objects

**AmortizationEntry** (sourced from CSV upload)
- `period` — sequential month number (1-based)
- `dueDate` — ISO date string (from CSV: `vervaldatum`)
- `capitalRepayment` — capital portion (from CSV: `kapitaalaflossing`)
- `interest` — interest portion (from CSV: `intrest`)
- `totalPayment` — total monthly payment (from CSV: `te betalen`)
- `remainingBalance` — outstanding capital after this payment (from CSV: `kapitaalsaldo`)

---

## CSV Format (KBC Amortization Table)

The importer expects the following semicolon-separated header columns:

```
vervaldatum;kapitaalaflossing;intrest;te betalen;kapitaalsaldo
```

Example rows:
```
01/05/2022;782,90;373,33;1156,23;229217,10
01/06/2022;784,17;372,06;1156,23;228432,93
```

> Decimal separator is `,` (comma). Date format is `DD/MM/YYYY`.

---

## Projection Logic

The **Net Worth Projection** chart calculates the following for each of the next 20 years (from today):

```
Projected Property Value(year) = currentValue × (1 + appreciationRate)^year

Remaining Loan Balance(year) = last entry in amortizationSchedule
                                where dueDate <= (today + year)

Net Worth(year) = Σ Projected Property Value(year)
               - Σ Remaining Loan Balance(year)
```

If no amortization schedule is uploaded, the remaining balance is estimated using a standard annuity formula as a fallback.

---

## Future Migration to Supabase

The localStorage JSON mirrors the intended Supabase schema:

| localStorage key | Supabase table |
|---|---|
| `properties[]` | `properties` |
| `properties[].loans[]` | `loans` |
| `loans[].amortizationSchedule[]` | `amortization_schedules` |
| `meta` | app config / user profile |

The service layer (`src/services/portfolioService.js`) abstracts all reads and writes, so swapping localStorage for Supabase API calls requires changes in **one file only**.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
src/
├── components/
│   ├── Layout.jsx            # Responsive shell (sidebar + main)
│   ├── Dashboard.jsx         # KPI cards + summary
│   ├── PropertyForm.jsx      # Add / edit property & loans
│   ├── CSVImporter.jsx       # KBC CSV upload & parser
│   └── ProjectionChart.jsx   # 20-year recharts area chart
├── hooks/
│   └── useLocalStorage.js    # Generic localStorage hook
├── services/
│   └── portfolioService.js   # Read / write abstraction (swap for Supabase later)
├── utils/
│   └── projectionUtils.js    # Net worth calculation helpers
├── App.jsx
└── main.jsx
```
