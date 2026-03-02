/**
 * Hold vs Sell Scenario Comparison
 * 
 * Compare portfolio outcomes: hold properties vs sell and reinvest proceeds.
 */

import { buildProjection } from '../projections/index.js'
import { computeSaleProceeds } from './saleProceeds.js'

/**
 * Build sell-vs-hold comparison dataset
 * 
 * Compares:
 * - "Hold" scenario: keep properties, normal appreciation
 * - "Sell & Reinvest" scenario: sell at year X, compound proceeds at reinvestment rate
 * 
 * @param {Array} properties - Properties in portfolio
 * @param {number} saleYear - Year to sell in "sell" scenario
 * @param {Object} config - Configuration:
 *   - reinvestRate: Annual return on reinvested proceeds (default 0.05)
 *   - brokeragePct: Brokerage fee (default 0.03)
 *   - prepaymentPct: Prepayment penalty (default 0.01)
 *   - registrationPct: Additional closing costs (default 0)
 * @returns {Array} 20-year comparison data points
 */
export function buildScenarioComparison(properties, saleYear, config = {}) {
  const {
    reinvestRate = 0.05,
    brokeragePct = 0.03,
    registrationPct = 0,
    prepaymentPct = 0.01,
  } = config

  const projection = buildProjection(properties)
  const sale = computeSaleProceeds(properties, saleYear, {
    brokeragePct,
    registrationPct,
    prepaymentPct
  })
  const netProceeds = sale.netProceeds

  return projection.map((point) => {
    const holdValue = point.netWorth

    let sellValue
    if (point.year < saleYear) {
      sellValue = holdValue // haven't sold yet
    } else {
      // Proceeds compounded at reinvest rate
      sellValue = Math.round(
        netProceeds * Math.pow(1 + reinvestRate, point.year - saleYear)
      )
    }

    return {
      ...point,
      holdValue,
      sellValue,
    }
  })
}
