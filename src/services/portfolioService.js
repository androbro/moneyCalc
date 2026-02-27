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

// ─── Field mappers ────────────────────────────────────────────────────────────

function dbToProperty(row) {
  return {
    id:                    row.id,
    name:                  row.name,
    address:               row.address ?? '',
    purchasePrice:         Number(row.purchase_price ?? 0),
    currentValue:          Number(row.current_value ?? 0),
    appreciationRate:      Number(row.appreciation_rate ?? 0.02),
    purchaseDate:          row.purchase_date ?? '',
    isRented:              row.is_rented ?? true,
    startRentalIncome:     Number(row.start_rental_income ?? 0),
    monthlyRentalIncome:   Number(row.start_rental_income ?? 0), // legacy alias
    indexationRate:        Number(row.indexation_rate ?? 0.02),
    monthlyExpenses:       Number(row.monthly_expenses ?? 0),
    annualMaintenanceCost: Number(row.annual_maintenance_cost ?? 0),
    annualInsuranceCost:   Number(row.annual_insurance_cost ?? 0),
    annualPropertyTax:     Number(row.annual_property_tax ?? 0),
    inflationRate:         Number(row.inflation_rate ?? 0.02),
    loans: [],
  }
}

function propertyToDb(p) {
  return {
    name:                   p.name,
    address:                p.address ?? '',
    purchase_price:         p.purchasePrice ?? 0,
    current_value:          p.currentValue ?? 0,
    appreciation_rate:      p.appreciationRate ?? 0.02,
    purchase_date:          p.purchaseDate || null,
    is_rented:              p.isRented ?? true,
    start_rental_income:    p.startRentalIncome ?? p.monthlyRentalIncome ?? 0,
    indexation_rate:        p.indexationRate ?? 0.02,
    monthly_expenses:       p.monthlyExpenses ?? 0,
    annual_maintenance_cost: p.annualMaintenanceCost ?? 0,
    annual_insurance_cost:   p.annualInsuranceCost ?? 0,
    annual_property_tax:     p.annualPropertyTax ?? 0,
    inflation_rate:          p.inflationRate ?? 0.02,
  }
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
  // 1. Insert property
  const { data: propData, error: propErr } = await supabase
    .from('properties')
    .insert(propertyToDb(property))
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
  // 1. Update property row
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultMeta() {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    currency: 'EUR',
  }
}
