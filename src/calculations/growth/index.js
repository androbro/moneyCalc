/**
 * Growth Calculations Module
 *
 * Exports growth roadmap simulation and advice generation functions.
 */

export {
  simulateGrowthRoadmap,
  computeAvailableEquity,
  computeMonthlySurplus,
  calcMonthlyPayment,
  calcBulletMonthlyPayment,
} from './growthRoadmap.js'

export { generateGrowthAdvice } from './growthAdvice.js'
