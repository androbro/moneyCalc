/**
 * guestStorage.js
 *
 * A localStorage-backed data layer that mirrors the exact public API of
 * portfolioService.js. Used for unauthenticated (guest) visitors so they
 * can fully interact with the app without touching Supabase.
 *
 * Keys used:
 *   mc_guest_portfolio   — { properties: [...] }
 *   mc_guest_household   — household profile object
 *   mc_guest_simulator   — simulator state object
 *
 * Seeding:
 *   App.jsx calls seedGuestStorage(portfolio, household, simulator) once on
 *   first load (when no guest data exists yet) to populate localStorage with
 *   a read-only snapshot of the real Supabase data. This gives every guest
 *   a fresh copy of your actual data to tinker with.
 *
 *   Calling seedGuestStorage again (from the "Reset to my data" button) always
 *   overwrites, restoring the owner's data.
 */

import { v4 as uuidv4 } from 'uuid'
import { defaultHousehold } from '../services/portfolioService'

// ─── Storage keys ─────────────────────────────────────────────────────────────

const PORTFOLIO_KEY  = 'mc_guest_portfolio'
const HOUSEHOLD_KEY  = 'mc_guest_household'
const SIMULATOR_KEY  = 'mc_guest_simulator'
const SEEDED_KEY     = 'mc_guest_seeded'   // flag: has the initial seed run?

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

/** Returns true if guest storage has already been seeded this browser. */
export function isGuestSeeded() {
  return localStorage.getItem(SEEDED_KEY) === 'true'
}

/**
 * Populate guest localStorage with a snapshot of the owner's Supabase data.
 * Always overwrites — used both for first-time seeding and the "Reset" button.
 */
export function seedGuestStorage(portfolio, household, simulator) {
  write(PORTFOLIO_KEY, portfolio)
  write(HOUSEHOLD_KEY, household)
  write(SIMULATOR_KEY, simulator || {})
  try { localStorage.setItem(SEEDED_KEY, 'true') } catch { /* ignore */ }
}

/** Wipe all guest data (useful for hard reset). */
export function clearGuestStorage() {
  ;[PORTFOLIO_KEY, HOUSEHOLD_KEY, SIMULATOR_KEY, SEEDED_KEY].forEach((k) => {
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
