/**
 * Custom Recharts tooltip for Dashboard projection charts.
 */

import { kFmt } from '../utils/formatters'

/** @param {{ active: boolean, payload: Array, label: string, suffix: string }} props */
export default function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="border border-white/[0.12] rounded-xl px-3 py-2"
      style={{
        background: 'rgba(8, 12, 22, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <p className="text-xs text-neo-muted mb-0.5">{label}</p>
      <p className="text-sm font-bold text-brand-400 tabular-nums">
        {kFmt(payload[0]?.value || 0)}{suffix}
      </p>
    </div>
  )
}
