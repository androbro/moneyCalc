/**
 * Dashboard Summary Calculations
 * 
 * Compute current portfolio snapshot for dashboard KPIs.
 */

import { getRemainingBalance, getLoanPaymentSplit } from '../loans/index.js'
import { isRentalActiveOn, getOwnershipShare } from '../utils/propertyUtils.js'

/**
 * Compute current portfolio summary
 * 
 * Returns comprehensive snapshot including:
 * - Total portfolio metrics (all owners)
 * - Personal net worth (my ownership share)
 * - Cash flow breakdown
 * - ROE (Return on Equity)
 * 
 * @param {Array} properties - Array of property objects
 * @param {Object} profile - Household profile (optional)
 * @returns {Object} Summary with all KPIs
 */
export function computeSummary(properties, profile = null) {
  let totalAssets = 0
  let totalLiabilities = 0
  let personalAssets = 0   // my share of property values
  let personalDebt = 0     // my share of loan balances
  let annualRentalIncome = 0
  let annualOpex = 0
  let annualInterest = 0
  let annualCapital = 0
  let activeRentalCount = 0

  const today = new Date()
  const todayISO = today.toISOString()

  // Exclude planned/simulated properties from live dashboard metrics
  const liveProperties = properties.filter((p) => p.status !== 'planned')

  for (const property of liveProperties) {
    const value = property.currentValue || 0
    totalAssets += value

    // My ownership share (default 100% if no owners array)
    const myShare = getOwnershipShare(property, 'Me')
    personalAssets += value * myShare

    if (isRentalActiveOn(property, today)) {
      const grossRent = (property.startRentalIncome || property.monthlyRentalIncome || 0) * 12
      const vacancyRate = property.vacancyRate ?? 0.05
      annualRentalIncome += grossRent * (1 - vacancyRate)
      activeRentalCount++
    }

    annualOpex += (property.annualMaintenanceCost || 0)
    annualOpex += (property.annualInsuranceCost || 0)
    annualOpex += (property.monthlyExpenses || 0) * 12
    annualOpex += (property.annualPropertyTax || 0)

    for (const loan of property.loans || []) {
      const balance = getRemainingBalance(loan, todayISO)
      totalLiabilities += balance
      personalDebt += balance * myShare
      
      const split = getLoanPaymentSplit(loan, today)
      annualInterest += split.monthlyInterest * 12
      annualCapital += split.monthlyCapital * 12
    }
  }

  const equity = totalAssets - totalLiabilities
  const personalRealEstateNetWorth = personalAssets - personalDebt

  // Personal cash & investments from household profile
  let personalCash = 0
  let personalInvestmentValue = 0
  
  if (profile?.members) {
    const me = profile.members.find((m) => m.isMe) ?? profile.members[0]
    if (me) {
      personalCash = me.cash || 0
      // Simple 1-year proxy: monthly × 12
      personalInvestmentValue = (me.investmentPositions || [])
        .reduce((s, p) => s + (p.monthlyAmount || 0) * 12, 0)
    }
  }

  const personalNetWorth = personalRealEstateNetWorth + personalCash
  const annualNetCF = annualRentalIncome - annualOpex - annualInterest
  const roe = equity > 0 ? (annualNetCF / equity) * 100 : 0

  return {
    // Full portfolio totals
    totalAssets,
    totalPortfolioValue: totalAssets,
    totalLiabilities,
    totalDebt: totalLiabilities,
    totalNetWorth: equity,
    
    // Personal breakdown
    personalRealEstateNetWorth,
    personalCash,
    personalInvestmentValue,
    personalNetWorth,
    
    // Cash flow
    totalMonthlyCashFlow: annualNetCF / 12,
    annualNetCashFlow: annualNetCF,
    monthlyInterest: annualInterest / 12,
    monthlyCapital: annualCapital / 12,
    annualRentalIncome,
    annualOpex,
    annualInterest,
    annualCapital,
    
    // Metrics
    roe,
    propertyCount: liveProperties.length,
    loanCount: liveProperties.reduce((sum, p) => sum + (p.loans?.length || 0), 0),
    activeRentalCount,
  }
}
