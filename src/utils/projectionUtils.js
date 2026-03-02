/**
 * projectionUtils.js - LEGACY COMPATIBILITY LAYER
 * 
 * This file maintains backward compatibility with existing imports.
 * All calculation logic has been refactored into src/calculations/
 * 
 * New code should import directly from src/calculations/
 * This file will be removed in a future version.
 */

// Re-export all functions from the new calculations module
export {
  // Loan calculations
  getRemainingBalance,
  getAnnualLoanPayment,
  getLoanPaymentSplit,
  
  // Projections
  buildProjection,
  computeSummary,
  
  // Scenarios
  computeSaleProceeds,
  computePropertySaleProceeds,
  buildScenarioComparison,
  buildPropertyScenarioComparison,
  simulateNewProperty,
  
  // Utilities
  monthsBetweenPublic,
  isRentalActiveOn,
  
  // Formatters
  formatEUR,
  formatPct,
} from '../calculations/index.js'
