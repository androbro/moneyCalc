/**
 * portfolioService.js
 *
 * All portfolio reads/writes now go through Supabase.
 * The public function signatures are identical to the old localStorage version
 * so no component changes are needed — except that functions are now async.
 *
 * DB → JS field mapping (snake_case → camelCase):
 *   properties.start_rental_income  → startRentalIncome
 *   properties.appreciation_rate    → appreciationRate
 *   loans.property_id               → propertyId
 *   loans.original_amount           → originalAmount
 *   amortization_schedules.*        → amortizationSchedule[]
 */

import { supabase } from '../lib/supabase'

// ─── Auth helper ──────────────────────────────────────────────────────────────

/** Returns the current user's UID, or null if not authenticated. */
async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ─── Field mappers ────────────────────────────────────────────────────────────

function dbToProperty(row) {
  return {
    id:                    row.id,
    name:                  row.name,
    address:               row.address ?? '',
    purchasePrice:         Number(row.purchase_price ?? 0),
    currentValue:          Number(row.current_value ?? 0),
    valuationDate:         row.valuation_date ?? '',
    appreciationRate:      Number(row.appreciation_rate ?? 0.02),
    purchaseDate:          row.purchase_date ?? '',
    // Actual acquisition costs (null = not entered → use estimate)
    registrationTax:       row.registration_tax   != null ? Number(row.registration_tax)   : null,
    notaryFees:            row.notary_fees         != null ? Number(row.notary_fees)         : null,
    agencyFees:            row.agency_fees         != null ? Number(row.agency_fees)         : null,
    otherAcquisitionCosts: row.other_acquisition_costs != null ? Number(row.other_acquisition_costs) : null,
    // Ownership
    owners:                Array.isArray(row.owners) ? row.owners : [{ name: 'Me', share: 1 }],
    // Status & rental period
    status:                row.status ?? 'rented',
    isRented:              row.is_rented ?? true,
    rentalStartDate:       row.rental_start_date ?? '',
    rentalEndDate:         row.rental_end_date ?? '',
    // Primary residence
    isPrimaryResidence:    row.is_primary_residence ?? false,
    residenceStartDate:    row.residence_start_date ?? '',
    residenceEndDate:      row.residence_end_date ?? '',
    // Income & costs
    startRentalIncome:     Number(row.start_rental_income ?? 0),
    monthlyRentalIncome:   Number(row.start_rental_income ?? 0), // legacy alias
    indexationRate:        Number(row.indexation_rate ?? 0.02),
    monthlyExpenses:       Number(row.monthly_expenses ?? 0),
    annualMaintenanceCost: Number(row.annual_maintenance_cost ?? 0),
    annualInsuranceCost:   Number(row.annual_insurance_cost ?? 0),
    annualPropertyTax:     Number(row.annual_property_tax ?? 0),
    inflationRate:         Number(row.inflation_rate ?? 0.02),
    vacancyRate:           Number(row.vacancy_rate ?? 0),
    loans: [],
  }
}

function propertyToDb(p, userId) {
  const row = {
    name:                    p.name,
    address:                 p.address ?? '',
    purchase_price:          p.purchasePrice ?? 0,
    current_value:           p.currentValue ?? 0,
    valuation_date:          p.valuationDate || null,
    appreciation_rate:       p.appreciationRate ?? 0.02,
    purchase_date:           p.purchaseDate || null,
    registration_tax:        p.registrationTax   ?? null,
    notary_fees:             p.notaryFees         ?? null,
    agency_fees:             p.agencyFees         ?? null,
    other_acquisition_costs: p.otherAcquisitionCosts ?? null,
    // Ownership
    owners:                  p.owners?.length ? p.owners : [{ name: 'Me', share: 1 }],
    // Status & rental period
    status:                  p.status ?? 'rented',
    is_rented:               p.isRented ?? true,
    rental_start_date:       p.rentalStartDate || null,
    rental_end_date:         p.rentalEndDate || null,
    // Primary residence
    is_primary_residence:    p.isPrimaryResidence ?? false,
    residence_start_date:    p.residenceStartDate || null,
    residence_end_date:      p.residenceEndDate || null,
    // Income & costs
    start_rental_income:     p.startRentalIncome ?? p.monthlyRentalIncome ?? 0,
    indexation_rate:         p.indexationRate ?? 0.02,
    monthly_expenses:        p.monthlyExpenses ?? 0,
    annual_maintenance_cost: p.annualMaintenanceCost ?? 0,
    annual_insurance_cost:   p.annualInsuranceCost ?? 0,
    annual_property_tax:     p.annualPropertyTax ?? 0,
    inflation_rate:          p.inflationRate ?? 0.02,
    vacancy_rate:            p.vacancyRate ?? 0,
  }
  // Include user_id when provided (required for INSERT to pass RLS)
  if (userId) row.user_id = userId
  return row
}

function dbToLoan(row, schedule = []) {
  return {
    id:                  row.id,
    propertyId:          row.property_id,
    lender:              row.lender ?? '',
    originalAmount:      Number(row.original_amount ?? 0),
    interestRate:        Number(row.interest_rate ?? 0),
    startDate:           row.start_date ?? '',
    termMonths:          Number(row.term_months ?? 0),
    monthlyPayment:      Number(row.monthly_payment ?? 0),
    amortizationSchedule: schedule,
  }
}

function loanToDb(l, propertyId) {
  return {
    property_id:     propertyId ?? l.propertyId,
    lender:          l.lender ?? '',
    original_amount: l.originalAmount ?? 0,
    interest_rate:   l.interestRate ?? 0,
    start_date:      l.startDate || null,
    term_months:     l.termMonths ?? 0,
    monthly_payment: l.monthlyPayment ?? 0,
  }
}

function dbToEntry(row) {
  return {
    period:           row.period,
    dueDate:          row.due_date,
    capitalRepayment: Number(row.capital_repayment ?? 0),
    interest:         Number(row.interest ?? 0),
    totalPayment:     Number(row.total_payment ?? 0),
    remainingBalance: Number(row.remaining_balance ?? 0),
  }
}

function entryToDb(e, loanId) {
  return {
    loan_id:           loanId,
    period:            e.period,
    due_date:          e.dueDate,
    capital_repayment: e.capitalRepayment,
    interest:          e.interest,
    total_payment:     e.totalPayment,
    remaining_balance: e.remainingBalance,
  }
}

// ─── Throw helper ─────────────────────────────────────────────────────────────

function check(error, context) {
  if (error) throw new Error(`[${context}] ${error.message}`)
}

// ─── Portfolio (full load) ────────────────────────────────────────────────────

/**
 * Load everything: properties → loans → amortization schedules.
 * Returns the same { properties, meta } shape the app expects.
 */
export async function getPortfolio() {
  // 1. properties
  const { data: propRows, error: propErr } = await supabase
    .from('properties')
    .select('*')
    .order('created_at')
  check(propErr, 'getPortfolio/properties')

  if (!propRows?.length) {
    return { properties: [], meta: defaultMeta() }
  }

  const propIds = propRows.map((p) => p.id)

  // 2. loans for all properties in one query
  const { data: loanRows, error: loanErr } = await supabase
    .from('loans')
    .select('*')
    .in('property_id', propIds)
    .order('created_at')
  check(loanErr, 'getPortfolio/loans')

  const loanIds = (loanRows ?? []).map((l) => l.id)

  // 3. amortization schedules for all loans in one query
  let scheduleRows = []
  if (loanIds.length > 0) {
    const { data, error: schedErr } = await supabase
      .from('amortization_schedules')
      .select('*')
      .in('loan_id', loanIds)
      .order('period')
    check(schedErr, 'getPortfolio/schedules')
    scheduleRows = data ?? []
  }

  // 4. planned investments for all properties in one query
  const { data: plannedRows, error: plannedErr } = await supabase
    .from('planned_investments')
    .select('*')
    .in('property_id', propIds)
    .order('planned_date')
  check(plannedErr, 'getPortfolio/plannedInvestments')

  // 5. Assemble
  const schedulesByLoan = {}
  for (const row of scheduleRows) {
    if (!schedulesByLoan[row.loan_id]) schedulesByLoan[row.loan_id] = []
    schedulesByLoan[row.loan_id].push(dbToEntry(row))
  }

  const loansByProperty = {}
  for (const row of (loanRows ?? [])) {
    if (!loansByProperty[row.property_id]) loansByProperty[row.property_id] = []
    loansByProperty[row.property_id].push(dbToLoan(row, schedulesByLoan[row.id] ?? []))
  }

  const plannedByProperty = {}
  for (const row of (plannedRows ?? [])) {
    if (!plannedByProperty[row.property_id]) plannedByProperty[row.property_id] = []
    plannedByProperty[row.property_id].push(dbToPlannedInvestment(row))
  }

  const properties = propRows.map((row) => ({
    ...dbToProperty(row),
    loans: loansByProperty[row.id] ?? [],
    plannedInvestments: plannedByProperty[row.id] ?? [],
  }))

  return { properties, meta: defaultMeta() }
}

// ─── Property CRUD ────────────────────────────────────────────────────────────

export async function addProperty(portfolio, property) {
  const userId = await getCurrentUserId()

  // 1. Insert property (user_id required for RLS INSERT policy)
  const { data: propData, error: propErr } = await supabase
    .from('properties')
    .insert(propertyToDb(property, userId))
    .select()
    .single()
  check(propErr, 'addProperty')

  const savedPropertyId = propData.id

  // 2. Insert loans + their schedules
  for (const loan of property.loans ?? []) {
    await _upsertLoan(savedPropertyId, { ...loan, id: undefined })
  }

  return getPortfolio()
}

export async function updateProperty(portfolio, property) {
  // 1. Update property row (user_id not changed on update — RLS handles authorization)
  const { error: propErr } = await supabase
    .from('properties')
    .update(propertyToDb(property))
    .eq('id', property.id)
  check(propErr, 'updateProperty')

  // 2. Sync loans: delete removed loans, upsert existing/new ones
  const { data: existingLoans, error: fetchErr } = await supabase
    .from('loans')
    .select('id')
    .eq('property_id', property.id)
  check(fetchErr, 'updateProperty/fetchLoans')

  const existingIds = new Set((existingLoans ?? []).map((l) => l.id))
  const incomingIds = new Set((property.loans ?? []).filter((l) => l.id).map((l) => l.id))

  // Delete loans that were removed
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('loans').delete().in('id', toDelete)
    check(delErr, 'updateProperty/deleteLoans')
  }

  // Upsert remaining/new loans
  for (const loan of property.loans ?? []) {
    await _upsertLoan(property.id, loan)
  }

  return getPortfolio()
}

export async function deleteProperty(portfolio, propertyId) {
  // Cascade delete handles loans + schedules via FK
  const { error } = await supabase.from('properties').delete().eq('id', propertyId)
  check(error, 'deleteProperty')
  return getPortfolio()
}

// ─── Loan upsert (internal) ───────────────────────────────────────────────────

async function _upsertLoan(propertyId, loan) {
  let loanId = loan.id

  if (loanId) {
    // Update existing loan
    const { error } = await supabase
      .from('loans')
      .update(loanToDb(loan, propertyId))
      .eq('id', loanId)
    check(error, '_upsertLoan/update')
  } else {
    // Insert new loan
    const { data, error } = await supabase
      .from('loans')
      .insert(loanToDb(loan, propertyId))
      .select()
      .single()
    check(error, '_upsertLoan/insert')
    loanId = data.id
  }

  // Sync amortization schedule if present
  if (loan.amortizationSchedule?.length > 0) {
    await attachAmortizationSchedule(null, null, loanId, loan.amortizationSchedule)
  }

  return loanId
}

// ─── Amortization schedule ────────────────────────────────────────────────────

/**
 * Replace the full amortization schedule for a loan.
 * portfolio and propertyId are accepted for API compatibility but not needed
 * when loanId is passed directly.
 */
export async function attachAmortizationSchedule(_portfolio, _propertyId, loanId, schedule) {
  // Delete existing rows for this loan
  const { error: delErr } = await supabase
    .from('amortization_schedules')
    .delete()
    .eq('loan_id', loanId)
  check(delErr, 'attachAmortizationSchedule/delete')

  if (!schedule?.length) return

  // Batch insert — Supabase handles up to ~500 rows per call; chunk for safety
  const CHUNK = 400
  for (let i = 0; i < schedule.length; i += CHUNK) {
    const chunk = schedule.slice(i, i + CHUNK).map((e) => entryToDb(e, loanId))
    const { error: insErr } = await supabase.from('amortization_schedules').insert(chunk)
    check(insErr, 'attachAmortizationSchedule/insert')
  }
}

// ─── Planned investment mappers ───────────────────────────────────────────────

function dbToPlannedInvestment(row) {
  return {
    id:            row.id,
    propertyId:    row.property_id,
    description:   row.description ?? '',
    plannedDate:   row.planned_date ?? '',
    cost:          Number(row.cost ?? 0),
    valueIncrease: Number(row.value_increase ?? 0),
  }
}

function plannedInvestmentToDb(inv) {
  return {
    property_id:    inv.propertyId,
    description:    inv.description ?? '',
    planned_date:   inv.plannedDate || null,
    cost:           inv.cost ?? 0,
    value_increase: inv.valueIncrease ?? 0,
  }
}

// ─── Planned investment CRUD ──────────────────────────────────────────────────

export async function addPlannedInvestment(inv) {
  const { error } = await supabase
    .from('planned_investments')
    .insert(plannedInvestmentToDb(inv))
  check(error, 'addPlannedInvestment')
  return getPortfolio()
}

export async function updatePlannedInvestment(inv) {
  const { error } = await supabase
    .from('planned_investments')
    .update(plannedInvestmentToDb(inv))
    .eq('id', inv.id)
  check(error, 'updatePlannedInvestment')
  return getPortfolio()
}

export async function deletePlannedInvestment(id) {
  const { error } = await supabase
    .from('planned_investments')
    .delete()
    .eq('id', id)
  check(error, 'deletePlannedInvestment')
  return getPortfolio()
}

// ─── Household profile ────────────────────────────────────────────────────────

/**
 * Shape of the household profile object used in JS (camelCase).
 * All income/expense values are monthly EUR unless noted otherwise.
 *
 * {
 *   members: [               – array of household members (stored as JSONB)
 *     {
 *       id                   – uuid string (client-generated)
 *       name                 – display name (e.g. "Me", "Sarah")
 *       netIncome            – monthly net salary
 *       investmentIncome     – monthly net investment / trading income
 *       cash                 – lump-sum cash available now
 *     }
 *   ]
 *   householdExpenses         – joint monthly living costs
 *   personalSavingsRate       – fraction (0–1) of total income kept as savings
 *   targetDownPayment         – cash target for the next property down-payment
 *   targetPurchaseYear        – calendar year you aim to buy the next property
 *   newResidencePrice         – agreed purchase price of new primary home
 *   newResidenceLoanAmount    – loan share taken together
 *   newResidenceMonthlyPayment – estimated monthly repayment
 *   newResidencePurchaseDate  – planned settlement date (ISO string)
 *
 * Legacy flat fields (kept for backward-compat with existing Supabase rows;
 * ignored when members array is present):
 *   myNetIncome, myInvestmentIncome, partnerNetIncome, partnerCash
 * }
 */

const PROFILE_ID = 'default'

function householdToDb(h, userId) {
  // Also mirror totals back into legacy columns so old queries still work
  const totalNetIncome        = (h.members || []).reduce((s, m) => s + (m.netIncome || 0), 0)
  const totalInvestmentIncome = (h.members || []).reduce((s, m) => s + (m.investmentIncome || 0), 0)
  const totalCash             = (h.members || []).reduce((s, m) => s + (m.cash || 0), 0)

  const row = {
    id:                           userId || PROFILE_ID,
    members:                      h.members ?? [],
    // Legacy mirrors
    my_net_income:                totalNetIncome,
    my_investment_income:         totalInvestmentIncome,
    partner_net_income:           0,
    partner_cash:                 totalCash,
    // Shared fields
    household_expenses:    h.householdExpenses ?? 0,
    personal_savings_rate: h.personalSavingsRate ?? 0.10,
  }
  if (userId) row.user_id = userId
  return row
}

function dbToHousehold(row) {
  // Prefer the structured members JSONB column if present
  if (Array.isArray(row.members) && row.members.length > 0) {
    return {
      members:             row.members,
      householdExpenses:   Number(row.household_expenses ?? 0),
      personalSavingsRate: Number(row.personal_savings_rate ?? 0.10),
    }
  }

  // Fall back to legacy flat columns
  const members = []
  const me = {
    id: 'member-me',
    name: 'Me',
    netIncome:        Number(row.my_net_income ?? 0),
    investmentIncome: Number(row.my_investment_income ?? 0),
    cash:             0,
  }
  const partner = {
    id: 'member-partner',
    name: 'Partner',
    netIncome:        Number(row.partner_net_income ?? 0),
    investmentIncome: 0,
    cash:             Number(row.partner_cash ?? 0),
  }
  // Only include if they have any data
  if (me.netIncome || me.investmentIncome) members.push(me)
  if (partner.netIncome || partner.cash) members.push(partner)

  return {
    members,
    householdExpenses:   Number(row.household_expenses ?? 0),
    personalSavingsRate: Number(row.personal_savings_rate ?? 0.10),
  }
}

export function defaultHousehold() {
  return {
    members: [{ id: 'member-me', name: 'Me', netIncome: 0, investmentIncome: 0, cash: 0, isMe: true }],
    householdExpenses: 0,
    personalSavingsRate: 0.10,
  }
}

/**
 * Guarantee the household profile always has at least one member marked isMe.
 * Called after loading from DB so downstream code never has to check for empty members.
 */
function ensureOwnerMember(profile) {
  const members = profile.members ?? []
  // If no members at all, bootstrap with a default owner
  if (members.length === 0) {
    return {
      ...profile,
      members: [{ id: 'member-me', name: 'Me', netIncome: 0, investmentIncome: 0, cash: 0, isMe: true }],
    }
  }
  // If no member is flagged isMe, promote the first member
  if (!members.some((m) => m.isMe)) {
    return {
      ...profile,
      members: members.map((m, i) => i === 0 ? { ...m, isMe: true } : m),
    }
  }
  return profile
}

/** Fetch the household profile row for the current user. */
export async function getHouseholdProfile() {
  const userId = await getCurrentUserId()
  const profileId = userId || PROFILE_ID

  const { data, error } = await supabase
    .from('household_profile')
    .select('*')
    .eq('id', profileId)

    .maybeSingle()
  check(error, 'getHouseholdProfile')
  return ensureOwnerMember(data ? dbToHousehold(data) : defaultHousehold())
}

/** Upsert the household profile for the current user. */
export async function saveHouseholdProfile(profile) {
  const userId = await getCurrentUserId()

  const { error } = await supabase
    .from('household_profile')
    .upsert(householdToDb(profile, userId), { onConflict: 'id' })
  check(error, 'saveHouseholdProfile')
  return getHouseholdProfile()
}

// ─── Simulator profile ────────────────────────────────────────────────────────

const SIMULATOR_ID = 'default'

/**
 * Load the simulator state blob for the current user.
 */
export async function getSimulatorProfile() {
  const userId = await getCurrentUserId()
  const simId = userId || SIMULATOR_ID

  const { data, error } = await supabase
    .from('simulator_profile')
    .select('state')
    .eq('id', simId)
    .maybeSingle()
  check(error, 'getSimulatorProfile')
  return data?.state ?? {}
}

/**
 * Persist the full simulator state for the current user.
 */
export async function saveSimulatorProfile(state) {
  const userId = await getCurrentUserId()
  const simId = userId || SIMULATOR_ID

  const row = { id: simId, state }
  if (userId) row.user_id = userId

  const { error } = await supabase
    .from('simulator_profile')
    .upsert(row, { onConflict: 'id' })
  check(error, 'saveSimulatorProfile')
}

// ─── Data migration: claim ownerless rows ─────────────────────────────────────

/**
 * Calls the `claim_ownerless_data` Postgres function to assign all rows
 * where user_id IS NULL to the currently signed-in user.
 *
 * This is the one-time migration step for the original owner.
 * Returns { properties, household_profile, simulator_profile } row counts.
 */
export async function claimOwnerlessData() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Must be signed in to claim data')

  const { data, error } = await supabase.rpc('claim_ownerless_data', { p_user_id: userId })
  check(error, 'claimOwnerlessData')
  return data
}

// ─── Share tokens ─────────────────────────────────────────────────────────────

const DEFAULT_PERMISSIONS = {
  dashboard:   true,
  properties:  true,
  financials:  true,
  household:   false,
}

/**
 * Returns the current user's share token row, or null if none exists.
 * Shape: { id, token, permissions, created_at }
 */
export async function getShareToken() {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('share_tokens')
    .select('id, token, permissions, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  check(error, 'getShareToken')
  return data ?? null
}

/**
 * Creates a new share token for the current user with the given permissions.
 * Returns the created row.
 */
export async function createShareToken(permissions = DEFAULT_PERMISSIONS) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Must be signed in to create a share link')

  // Generate a URL-safe random token client-side (24 random bytes → 32 base64url chars)
  const raw = crypto.getRandomValues(new Uint8Array(24))
  const token = btoa(String.fromCharCode(...raw))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const { data, error } = await supabase
    .from('share_tokens')
    .insert({ user_id: userId, token, permissions })
    .select('id, token, permissions, created_at')
    .single()
  check(error, 'createShareToken')
  return data
}

/**
 * Updates the permissions on the current user's share token.
 * Returns the updated row.
 */
export async function updateSharePermissions(tokenId, permissions) {
  const { data, error } = await supabase
    .from('share_tokens')
    .update({ permissions })
    .eq('id', tokenId)
    .select('id, token, permissions, created_at')
    .single()
  check(error, 'updateSharePermissions')
  return data
}

/**
 * Deletes (revokes) the current user's share token.
 */
export async function revokeShareToken(tokenId) {
  const { error } = await supabase
    .from('share_tokens')
    .delete()
    .eq('id', tokenId)
  check(error, 'revokeShareToken')
}

/**
 * Resolves a public share token (callable by unauthenticated users).
 * Returns the full portfolio snapshot via the `get_shared_portfolio` RPC.
 * The RPC returns { user_id, permissions, properties (raw DB rows), household (raw DB row) }
 */
export async function getSharedPortfolio(token) {
  const { data, error } = await supabase.rpc('get_shared_portfolio', { p_token: token })
  if (error) throw new Error(error.message)
  if (!data) return null

  // Map raw DB rows to the same camelCase shape the rest of the app uses
  const rawProperties = Array.isArray(data.properties) ? data.properties : []
  const properties = rawProperties.map(raw => {
    const p = dbToProperty(raw)
    // Attach nested loans (already assembled by the SQL function)
    p.loans = (raw.loans || []).map(l => ({
      id:               l.id,
      propertyId:       l.property_id,
      lender:           l.lender ?? '',
      originalAmount:   Number(l.original_amount ?? 0),
      interestRate:     Number(l.interest_rate ?? 0),
      startDate:        l.start_date ?? '',
      termMonths:       Number(l.term_months ?? 0),
      monthlyPayment:   Number(l.monthly_payment ?? 0),
      amortizationSchedule: (l.amortization_schedule || []).map(a => ({
        period:           a.period,
        dueDate:          a.due_date ?? '',
        capitalRepayment: Number(a.capital_repayment ?? 0),
        interest:         Number(a.interest ?? 0),
        totalPayment:     Number(a.total_payment ?? 0),
        remainingBalance: Number(a.remaining_balance ?? 0),
      })),
    }))
    p.plannedInvestments = (raw.planned_investments || []).map(pi => ({
      id:            pi.id,
      propertyId:    pi.property_id,
      description:   pi.description ?? '',
      plannedDate:   pi.planned_date ?? '',
      cost:          Number(pi.cost ?? 0),
      valueIncrease: Number(pi.value_increase ?? 0),
    }))
    return p
  })

  const household = data.household
    ? ensureOwnerMember(dbToHousehold(data.household))
    : defaultHousehold()

  return {
    permissions: data.permissions,
    properties,
    household,
  }
}

// ─── Revolut trading account ──────────────────────────────────────────────────

/**
 * Shape of a single trade row (camelCase in JS):
 * {
 *   id           – uuid
 *   tradedAt     – ISO timestamp string
 *   ticker       – e.g. "EXI2" | null for CASH TOP-UP
 *   type         – "CASH TOP-UP" | "BUY - MARKET" | "BUY - LIMIT" |
 *                  "SELL - MARKET" | "SELL - LIMIT" | "DIVIDEND"
 *   quantity     – number | null
 *   pricePerShare – number | null
 *   totalAmount  – number (always positive)
 *   currency     – "EUR" | "USD" | …
 *   fxRate       – number (1 when currency === EUR)
 * }
 */

function dbToTrade(row) {
  return {
    id:            row.id,
    tradedAt:      row.traded_at,
    ticker:        row.ticker ?? null,
    type:          row.type,
    quantity:      row.quantity != null ? Number(row.quantity) : null,
    pricePerShare: row.price_per_share != null ? Number(row.price_per_share) : null,
    totalAmount:   Number(row.total_amount ?? 0),
    currency:      row.currency ?? 'EUR',
    fxRate:        Number(row.fx_rate ?? 1),
  }
}

function tradeToDb(t, userId) {
  const row = {
    traded_at:       t.tradedAt,
    ticker:          t.ticker ?? null,
    type:            t.type,
    quantity:        t.quantity ?? null,
    price_per_share: t.pricePerShare ?? null,
    total_amount:    t.totalAmount,
    currency:        t.currency ?? 'EUR',
    fx_rate:         t.fxRate ?? 1,
  }
  if (userId) row.user_id = userId
  return row
}

/** Fetch all trades for the current user, newest first. */
export async function getTrades() {
  const { data, error } = await supabase
    .from('revolut_trades')
    .select('*')
    .order('traded_at', { ascending: false })
  check(error, 'getTrades')
  return (data ?? []).map(dbToTrade)
}

/**
 * Upsert a batch of parsed trade rows.
 * Duplicate rows (same user_id + traded_at + ticker + type + total_amount + currency)
 * are silently ignored thanks to the ON CONFLICT DO NOTHING clause.
 *
 * Returns the number of rows actually inserted.
 */
export async function importTrades(trades) {
  if (!trades?.length) return 0
  const userId = await getCurrentUserId()

  const rows = trades.map((t) => tradeToDb(t, userId))

  // Chunk to stay under Supabase's row limit per request
  const CHUNK = 400
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error, count } = await supabase
      .from('revolut_trades')
      .upsert(chunk, {
        onConflict: 'user_id,traded_at,ticker,type,total_amount,currency',
        ignoreDuplicates: true,
        count: 'exact',
      })
    check(error, 'importTrades')
    inserted += count ?? 0
  }
  return inserted
}

/** Delete all revolut trades for the current user. */
export async function clearTrades() {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('revolut_trades')
    .delete()
    .eq('user_id', userId)
  check(error, 'clearTrades')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultMeta() {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    currency: 'EUR',
  }
}
