/**
 * Loan Balance Calculations
 * 
 * Functions to calculate remaining loan balance using either amortization
 * schedules or annuity formulas.
 */

import { monthsBetween } from '../utils/dateUtils.js'

/**
 * Calculate remaining balance using annuity formula
 * 
 * Formula: balance = principal × [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
 * 
 * @param {number} principal - Original loan amount
 * @param {number} monthlyRate - Monthly interest rate (annual rate / 12)
 * @param {number} totalMonths - Total loan term in months
 * @param {number} paidMonths - Number of months already paid
 * @returns {number} Remaining balance
 */
export function calculateAnnuityRemainingBalance(principal, monthlyRate, totalMonths, paidMonths) {
  if (monthlyRate === 0) {
    return Math.max(0, principal * (1 - paidMonths / totalMonths))
  }
  
  if (paidMonths >= totalMonths) {
    return 0
  }
  
  const r = monthlyRate
  const N = totalMonths
  const n = Math.max(0, paidMonths)
  
  return Math.max(
    0,
    principal * (Math.pow(1 + r, N) - Math.pow(1 + r, n)) / (Math.pow(1 + r, N) - 1)
  )
}

/**
 * Get remaining balance from amortization schedule
 * 
 * @param {Array} amortizationSchedule - Array of payment entries with dueDate and remainingBalance
 * @param {Date} targetDate - Date to calculate balance for
 * @param {number} originalAmount - Original loan amount (fallback if no schedule entries before targetDate)
 * @returns {number} Remaining balance
 */
export function getBalanceFromSchedule(amortizationSchedule, targetDate, originalAmount) {
  if (!amortizationSchedule || amortizationSchedule.length === 0) {
    return null // Signal that schedule-based calculation is not possible
  }
  
  const target = new Date(targetDate)
  const past = amortizationSchedule
    .filter((e) => new Date(e.dueDate) <= target)
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))

  if (past.length > 0) {
    return Math.max(0, past[0].remainingBalance)
  }
  
  return originalAmount // Before first payment
}

/**
 * Get remaining loan balance at a specific date
 * 
 * Uses amortization schedule if available, falls back to annuity formula.
 * 
 * @param {Object} loan - Loan object with properties:
 *   - amortizationSchedule: Array of payment entries (optional)
 *   - originalAmount: Original loan amount
 *   - interestRate: Annual interest rate (e.g., 0.03 for 3%)
 *   - termMonths: Total loan term in months
 *   - startDate: Loan start date (ISO string)
 * @param {string} targetDate - Target date (ISO string)
 * @returns {number} Remaining balance
 */
export function getRemainingBalance(loan, targetDate) {
  const {
    amortizationSchedule = [],
    originalAmount,
    interestRate,
    termMonths,
    startDate
  } = loan

  // Try schedule-based calculation first
  const scheduleBalance = getBalanceFromSchedule(
    amortizationSchedule,
    targetDate,
    originalAmount
  )
  
  if (scheduleBalance !== null) {
    return scheduleBalance
  }

  // Fall back to annuity formula
  return calculateAnnuityRemainingBalance(
    originalAmount,
    interestRate / 12,
    termMonths,
    monthsBetween(new Date(startDate), new Date(targetDate))
  )
}
