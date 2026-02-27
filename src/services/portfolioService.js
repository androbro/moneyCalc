/**
 * portfolioService.js
 *
 * Abstraction layer for all portfolio data reads and writes.
 * Currently backed by localStorage.
 *
 * To migrate to Supabase:
 *  1. Replace the localStorage calls below with Supabase client calls.
 *  2. Make the functions async where needed.
 *  3. No changes required in components — they all consume this service.
 */

const STORAGE_KEY = 'moneyCalc_portfolio'

/** @returns {Portfolio} */
export function getPortfolio() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // corrupted data — return empty portfolio
  }
  return emptyPortfolio()
}

/** @param {Portfolio} portfolio */
export function savePortfolio(portfolio) {
  const updated = {
    ...portfolio,
    meta: {
      ...portfolio.meta,
      lastUpdated: new Date().toISOString(),
    },
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// ---------------------------------------------------------------------------
// Property CRUD
// ---------------------------------------------------------------------------

export function addProperty(portfolio, property) {
  return savePortfolio({
    ...portfolio,
    properties: [...portfolio.properties, property],
  })
}

export function updateProperty(portfolio, updatedProperty) {
  return savePortfolio({
    ...portfolio,
    properties: portfolio.properties.map((p) =>
      p.id === updatedProperty.id ? updatedProperty : p
    ),
  })
}

export function deleteProperty(portfolio, propertyId) {
  return savePortfolio({
    ...portfolio,
    properties: portfolio.properties.filter((p) => p.id !== propertyId),
  })
}

// ---------------------------------------------------------------------------
// Loan CRUD (nested inside a property)
// ---------------------------------------------------------------------------

export function addLoan(portfolio, propertyId, loan) {
  return savePortfolio({
    ...portfolio,
    properties: portfolio.properties.map((p) =>
      p.id === propertyId
        ? { ...p, loans: [...(p.loans || []), loan] }
        : p
    ),
  })
}

export function updateLoan(portfolio, propertyId, updatedLoan) {
  return savePortfolio({
    ...portfolio,
    properties: portfolio.properties.map((p) =>
      p.id === propertyId
        ? {
            ...p,
            loans: p.loans.map((l) =>
              l.id === updatedLoan.id ? updatedLoan : l
            ),
          }
        : p
    ),
  })
}

export function deleteLoan(portfolio, propertyId, loanId) {
  return savePortfolio({
    ...portfolio,
    properties: portfolio.properties.map((p) =>
      p.id === propertyId
        ? { ...p, loans: p.loans.filter((l) => l.id !== loanId) }
        : p
    ),
  })
}

// ---------------------------------------------------------------------------
// Amortization schedule
// ---------------------------------------------------------------------------

export function attachAmortizationSchedule(
  portfolio,
  propertyId,
  loanId,
  schedule
) {
  return savePortfolio({
    ...portfolio,
    properties: portfolio.properties.map((p) =>
      p.id === propertyId
        ? {
            ...p,
            loans: p.loans.map((l) =>
              l.id === loanId
                ? { ...l, amortizationSchedule: schedule }
                : l
            ),
          }
        : p
    ),
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyPortfolio() {
  return {
    properties: [],
    meta: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      currency: 'EUR',
    },
  }
}
