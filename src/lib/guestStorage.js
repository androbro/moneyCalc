/**
 * guestStorage.js
 *
 * A localStorage-backed data layer that mirrors the exact public API of
 * portfolioService.js. Used for unauthenticated (guest) visitors so they
 * can fully interact with the app without touching Supabase.
 *
 * Guests start with a pre-built mock dataset (see mockData.js).
 * Their edits stay in localStorage for the duration of the session but
 * never reach the real database.
 */

import { v4 as uuidv4 } from 'uuid'
import { getMockPortfolio, getMockHousehold, getMockSimulatorProfile } from './mockData'

// ─── Storage keys ─────────────────────────────────────────────────────────────

const PORTFOLIO_KEY  = 'mc_guest_portfolio'
const HOUSEHOLD_KEY  = 'mc_guest_household'
const SIMULATOR_KEY  = 'mc_guest_simulator'
const TRADES_KEY     = 'mc_guest_trades'
const GROWTH_KEY     = 'mc_guest_growth_planner'

// ─── Raw helpers ──────────────────────────────────────────────────────────────

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage full — silently ignore */ }
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

/**
 * Seed guest localStorage with the static mock dataset.
 * Called once on first load if the guest has no prior session data.
 */
export function seedGuestStorage() {
  if (!localStorage.getItem(PORTFOLIO_KEY)) {
    write(PORTFOLIO_KEY, getMockPortfolio())
  }
  if (!localStorage.getItem(HOUSEHOLD_KEY)) {
    write(HOUSEHOLD_KEY, getMockHousehold())
  }
  if (!localStorage.getItem(SIMULATOR_KEY)) {
    write(SIMULATOR_KEY, getMockSimulatorProfile())
  }
  if (!localStorage.getItem(GROWTH_KEY)) {
    write(GROWTH_KEY, {})
  }
}

/** Wipe all guest data and re-seed from mock data. */
export function clearGuestStorage() {
  ;[PORTFOLIO_KEY, HOUSEHOLD_KEY, SIMULATOR_KEY, GROWTH_KEY].forEach((k) => {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  })
}

/** Reset guest storage to the fresh mock dataset. */
export function resetGuestStorage() {
  write(PORTFOLIO_KEY, getMockPortfolio())
  write(HOUSEHOLD_KEY, getMockHousehold())
  write(SIMULATOR_KEY, getMockSimulatorProfile())
  write(GROWTH_KEY, {})
}

// ─── Portfolio API (mirrors portfolioService.js) ──────────────────────────────

function readPortfolio() {
  return read(PORTFOLIO_KEY, getMockPortfolio())
}

function writePortfolio(portfolio) {
  write(PORTFOLIO_KEY, portfolio)
  return portfolio
}

export async function getPortfolio() {
  return readPortfolio()
}

export async function addProperty(_portfolio, property) {
  const portfolio = readPortfolio()
  const newProp = {
    ...property,
    id: property.id || uuidv4(),
    loans: property.loans || [],
    plannedInvestments: property.plannedInvestments || [],
  }
  portfolio.properties = [...portfolio.properties, newProp]
  return writePortfolio(portfolio)
}

export async function updateProperty(_portfolio, property) {
  const portfolio = readPortfolio()
  portfolio.properties = portfolio.properties.map((p) =>
    p.id === property.id ? { ...p, ...property } : p
  )
  return writePortfolio(portfolio)
}

export async function deleteProperty(_portfolio, propertyId) {
  const portfolio = readPortfolio()
  portfolio.properties = portfolio.properties.filter((p) => p.id !== propertyId)
  return writePortfolio(portfolio)
}

export async function addPlannedInvestment(inv) {
  const portfolio = readPortfolio()
  const newInv = { ...inv, id: inv.id || uuidv4() }
  portfolio.properties = portfolio.properties.map((p) =>
    p.id === inv.propertyId
      ? { ...p, plannedInvestments: [...(p.plannedInvestments || []), newInv] }
      : p
  )
  return writePortfolio(portfolio)
}

export async function updatePlannedInvestment(inv) {
  const portfolio = readPortfolio()
  portfolio.properties = portfolio.properties.map((p) => ({
    ...p,
    plannedInvestments: (p.plannedInvestments || []).map((i) =>
      i.id === inv.id ? { ...i, ...inv } : i
    ),
  }))
  return writePortfolio(portfolio)
}

export async function deletePlannedInvestment(id) {
  const portfolio = readPortfolio()
  portfolio.properties = portfolio.properties.map((p) => ({
    ...p,
    plannedInvestments: (p.plannedInvestments || []).filter((i) => i.id !== id),
  }))
  return writePortfolio(portfolio)
}

// ─── Household profile API ────────────────────────────────────────────────────

function ensureOwnerMember(profile) {
  const members = profile.members ?? []
  if (members.length === 0) {
    return {
      ...profile,
      members: [{ id: 'member-me', name: 'Me', netIncome: 0, investmentIncome: 0, cash: 0, isMe: true }],
    }
  }
  if (!members.some((m) => m.isMe)) {
    return { ...profile, members: members.map((m, i) => i === 0 ? { ...m, isMe: true } : m) }
  }
  return profile
}

export async function getHouseholdProfile() {
  const profile = ensureOwnerMember(read(HOUSEHOLD_KEY, getMockHousehold()))
  // Seed dashboardLayout on first load (lazy import to avoid circular deps)
  if (!profile.dashboardLayout) {
    const { getDefaultLayouts } = await import('../components/Dashboard/widgetRegistry')
    return { ...profile, dashboardLayout: getDefaultLayouts() }
  }
  return profile
}

export async function saveHouseholdProfile(profile) {
  write(HOUSEHOLD_KEY, profile)
  return profile
}

// ─── Simulator profile API ────────────────────────────────────────────────────

export async function getSimulatorProfile() {
  return read(SIMULATOR_KEY, {})
}

export async function saveSimulatorProfile(state) {
  write(SIMULATOR_KEY, state)
}

// ─── Growth planner profile API ───────────────────────────────────────────────

export async function getGrowthPlannerProfile() {
  return read(GROWTH_KEY, {})
}

export async function saveGrowthPlannerProfile(state) {
  write(GROWTH_KEY, state ?? {})
  return state ?? {}
}

// ─── Revolut trading account API (mirrors portfolioService.js) ─────────────────

export async function getTrades() {
  return read(TRADES_KEY, [])
}

export async function importTrades(trades) {
  if (!trades?.length) return 0
  const existing = read(TRADES_KEY, [])

  // Deduplicate by the same key used in the Supabase unique constraint
  const key = (t) => `${t.tradedAt}|${t.ticker ?? ''}|${t.type}|${t.totalAmount}|${t.currency}`
  const existingKeys = new Set(existing.map(key))

  const newTrades = trades
    .filter((t) => !existingKeys.has(key(t)))
    .map((t) => ({ ...t, id: t.id || uuidv4() }))

  write(TRADES_KEY, [...newTrades, ...existing])
  return newTrades.length
}

export async function clearTrades() {
  write(TRADES_KEY, [])
}
