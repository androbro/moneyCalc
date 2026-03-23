import { useState, useRef, useEffect } from 'react'

/**
 * InfoTooltip Component
 * 
 * Displays a hoverable info icon that shows a tooltip with detailed information.
 * 
 * @param {string} content - The tooltip content (can be JSX)
 * @param {string} position - Tooltip position: 'top', 'bottom', 'left', 'right' (default: 'top')
 * @param {string} size - Icon size: 'sm', 'md', 'lg' (default: 'sm')
 */
export default function InfoTooltip({ content, position = 'top', size = 'sm' }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const iconRef = useRef(null)
  const tooltipRef = useRef(null)

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  useEffect(() => {
    if (visible && iconRef.current && tooltipRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      
      let x = 0
      let y = 0
      
      switch (position) {
        case 'top':
          x = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2
          y = iconRect.top - tooltipRect.height - 8
          break
        case 'bottom':
          x = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2
          y = iconRect.bottom + 8
          break
        case 'left':
          x = iconRect.left - tooltipRect.width - 8
          y = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2
          break
        case 'right':
          x = iconRect.right + 8
          y = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2
          break
        default:
          x = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2
          y = iconRect.top - tooltipRect.height - 8
      }
      
      // Keep tooltip in viewport
      x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8))
      y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8))
      
      setCoords({ x, y })
    }
  }, [visible, position])

  return (
    <>
      <button
        ref={iconRef}
        type="button"
        className="inline-flex items-center justify-center text-neo-muted hover:text-neo-muted transition-colors cursor-help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="More information"
      >
        <svg
          className={sizeClasses[size]}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] bg-neo-surface border border-white/60 rounded-2xl p-3 shadow-neo-lg text-xs max-w-sm pointer-events-none text-neo-muted"
          style={{
            left: `${coords.x}px`,
            top: `${coords.y}px`,
          }}
        >
          <div className="text-neo-text/95 leading-relaxed">
            {content}
          </div>
          {/* Arrow indicator */}
          <div
            className={`absolute w-2 h-2 bg-neo-surface border-neo-border transform rotate-45 ${
              position === 'top'
                ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-r border-b'
                : position === 'bottom'
                ? 'top-[-5px] left-1/2 -translate-x-1/2 border-l border-t'
                : position === 'left'
                ? 'right-[-5px] top-1/2 -translate-y-1/2 border-r border-t'
                : 'left-[-5px] top-1/2 -translate-y-1/2 border-l border-b'
            }`}
          />
        </div>
      )}
    </>
  )
}
