/**
 * RadialGauge — animated SVG arc showing a 0–100% value with a center label.
 */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { SOFT_EASE } from '../utils/constants'

/**
 * @param {{ pct: number, label: string }} props
 */
export default function RadialGauge({ pct, label }) {
  const [animatedPct, setAnimatedPct] = useState(0)
  const previousPctRef = useRef(0)
  const clampedPct = Math.max(0, Math.min(100, pct))

  useEffect(() => {
    const from     = previousPctRef.current
    const to       = clampedPct
    const duration = 700
    let rafId      = null

    function tick(startTime) {
      rafId = requestAnimationFrame((now) => {
        const elapsed  = now - startTime
        const progress = Math.min(1, elapsed / duration)
        const eased    = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setAnimatedPct(from + (to - from) * eased)
        if (progress < 1) tick(startTime)
        else previousPctRef.current = to
      })
    }

    tick(performance.now())
    return () => { if (rafId !== null) cancelAnimationFrame(rafId) }
  }, [clampedPct])

  const r           = 48
  const cx          = 70
  const cy          = 70
  const circumference = 2 * Math.PI * r
  const dashOffset  = circumference - (animatedPct / 100) * circumference

  return (
    <motion.svg
      width="140" height="140" viewBox="0 0 140 140"
      className="shrink-0"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.2, ease: SOFT_EASE }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <motion.circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="#ea580c" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 0.7, ease: SOFT_EASE }}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: 'drop-shadow(0 0 8px rgba(234,88,12,0.7))' }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f4" fontSize="22" fontWeight="bold" fontFamily="Inter, sans-serif">
        {Math.round(animatedPct)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#8897b5" fontSize="11" fontFamily="Inter, sans-serif">
        {label}
      </text>
    </motion.svg>
  )
}
