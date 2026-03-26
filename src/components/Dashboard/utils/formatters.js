/**
 * Pure formatting utilities for the Dashboard.
 * No React imports — safe to use in tests or non-component code.
 */

import { formatEUR } from '../../../utils/projectionUtils'

/**
 * Compact EUR formatter: shows €1.2M / €230k / €450 as appropriate.
 * @param {number} v
 * @returns {string}
 */
export function kFmt(v) {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`
  return formatEUR(v)
}

/**
 * Human-readable label for a 0–100 health score.
 * @param {number} score
 * @returns {'Very Healthy'|'Healthy'|'Fair'|'At Risk'}
 */
export function healthLabel(score) {
  if (score >= 80) return 'Very Healthy'
  if (score >= 60) return 'Healthy'
  if (score >= 40) return 'Fair'
  return 'At Risk'
}
