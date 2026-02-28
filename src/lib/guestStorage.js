/**
 * guestStorage.js
 *
 * A localStorage-backed data layer that mirrors the exact public API of
 * portfolioService.js. Used for unauthenticated (guest) visitors so they
 * can fully interact with the app without touching Supabase.
 *
 * Seeding behaviour:
 *   - On every page load (including refreshes), guests always get a fresh
 *     snapshot from Supabase. This means they always see your latest data
 *     without you having to do anything.
 *   - Within the same page session, their edits land in localStorage so
 *     in-page navigation between tabs doesn't lose their changes.
 *   - The "Reset" button re-seeds from Supabase at any time.
 *
 * Note: We intentionally do NOT cache the "seeded" state in sessionStorage.
 * sessionStorage survives page refreshes (per the Web spec), which would
 * prevent guests from seeing updates you make on localhost. Instead, we
 * always fetch a fresh snapshot from Supabase on every page load.
 */

import { v4 as uuidv4 } from 'uuid'
import { defaultHousehold } from '../services/portfolioService'

// ─── Storage keys ─────────────────────────────────────────────────────────────

const PORTFOLIO_KEY   = 'mc_guest_portfolio'
const HOUSEHOLD_KEY   = 'mc_guest_household'
const SIMULATOR_KEY   = 'mc_guest_simulator'

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
 * Populate guest localStorage with a snapshot of the owner's Supabase data.
 * Called on every page load so guests always see the latest data.
 */
export function seedGuestStorage(portfolio, household, simulator) {
  write(PORTFOLIO_KEY, portfolio)
  write(HOUSEHOLD_KEY, household)
  write(SIMULATOR_KEY, simulator || {})
}

/** Wipe all guest data. */
export function clearGuestStorage() {
  ;[PORTFOLIO_KEY, HOUSEHOLD_KEY, SIMULATOR_KEY].forEach((k) => {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  })
}

// ─── Portfolio API (mirrors portfolioService.js) ──────────────────────────────

function readPortfolio() {
  return read(PORTFOLIO_KEY, { properties: [] })
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

export async function getHouseholdProfile() {
  return read(HOUSEHOLD_KEY, defaultHousehold())
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
