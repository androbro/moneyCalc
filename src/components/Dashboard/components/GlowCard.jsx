/**
 * GlowCard — a motion.div with a radial-gradient spotlight that follows the cursor.
 * Wraps content with an interactive glow effect on hover.
 */

import { useState } from 'react'
import { motion } from 'motion/react'

export default function GlowCard({
  children,
  className = '',
  style,
  glowSize = 220,
  glowOpacity = 0.16,
  borderGlowSize = 180,
  borderGlowOpacity = 0.34,
  whileHover,
  overflowVisible = false,
  ...motionProps
}) {
  const [glow, setGlow] = useState({ x: 0, y: 0, active: false })

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    setGlow({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true })
  }

  function handleMouseLeave() {
    setGlow((prev) => ({ ...prev, active: false }))
  }

  return (
    <motion.div
      {...motionProps}
      className={`${className} relative ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}
      style={style}
      whileHover={whileHover}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-200"
        style={{
          opacity: glow.active ? 1 : 0,
          background: `radial-gradient(${glowSize}px circle at ${glow.x}px ${glow.y}px, rgba(234,88,12,${glowOpacity}), rgba(234,88,12,0) 72%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] p-px transition-opacity duration-200"
        style={{
          opacity: glow.active ? 1 : 0,
          background: `radial-gradient(${borderGlowSize}px circle at ${glow.x}px ${glow.y}px, rgba(251,146,60,${borderGlowOpacity}), rgba(251,146,60,0) 72%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
