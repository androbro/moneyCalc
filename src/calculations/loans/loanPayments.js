/**
 * Loan Payment Calculations
 * 
 * Functions to calculate loan payments and split them into interest vs capital components.
 */

import { monthsBetween } from '../utils/dateUtils.js'
import { getRemainingBalance } from './loanBalance.js'

/**
 * Calculate total annual loan payments within a year window
 * 
 * Returns sum of all payments (capital + interest) that fall within the specified year.
 * 
 * @param {Object} loan - Loan object
 * @param {number} year - Year offset from today (0 = current year)
 * @returns {number} Total annual payment amount
 */
export function getAnnualLoanPayment(loan, year) {
  const today = new Date()
  const yearStart = new Date(today.getFullYear() + year, today.getMonth(), today.getDate())
  const yearEnd = new Date(today.getFullYear() + year + 1, today.getMonth(), today.getDate())

  const { amortizationSchedule = [], monthlyPayment, termMonths, startDate } = loan

  // Use amortization schedule if available
  if (amortizationSchedule.length > 0) {
    return amortizationSchedule
      .filter((e) => {
        const d = new Date(e.dueDate)
        return d >= yearStart && d < yearEnd
      })
      .reduce((sum, e) => sum + e.totalPayment, 0)
  }

  // Fallback: estimate from monthly payment
  const start = new Date(startDate)
  const windowStart = monthsBetween(start, yearStart)
  const windowEnd = monthsBetween(start, yearEnd)
  const activeMonths = Math.max(
    0,
    Math.min(windowEnd, termMonths) - Math.max(0, windowStart)
  )
  
  return activeMonths * (monthlyPayment || 0)
}

/**
 * Split loan payment into interest and capital components
 * 
 * Uses amortization schedule if available, otherwise estimates using annuity formula.
 * 
 * @param {Object} loan - Loan object
 * @param {Date} date - Date to calculate split for (defaults to today)
 * @returns {Object} Payment split: { monthlyInterest, monthlyCapital, monthlyTotal }
 */
export function getLoanPaymentSplit(loan, date = new Date()) {
  const {
    amortizationSchedule = [],
    originalAmount,
    interestRate,
    termMonths,
    startDate,
    monthlyPayment
  } = loan
  
  const totalPayment = monthlyPayment || 0

  // Use amortization schedule if available
  if (amortizationSchedule.length > 0) {
    const today = date
    const past = amortizationSchedule
      .filter((e) => new Date(e.dueDate) <= today)
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
      
    if (past.length > 0) {
      return {
        monthlyInterest: past[0].interest || 0,
        monthlyCapital: past[0].capitalRepayment || 0,
        monthlyTotal: past[0].totalPayment || totalPayment,
      }
    }
  }

  // Fallback: estimate using annuity formula
  if (!originalAmount || !interestRate || !startDate) {
    return {
      monthlyInterest: 0,
      monthlyCapital: totalPayment,
      monthlyTotal: totalPayment
    }
  }
  
  const balance = getRemainingBalance(loan, date.toISOString())
  const monthlyRate = interestRate / 12
  const interest = balance * monthlyRate
  const capital = Math.max(0, totalPayment - interest)
  
  return {
    monthlyInterest: interest,
    monthlyCapital: capital,
    monthlyTotal: totalPayment
  }
}
