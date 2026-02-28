/**
 * InfoPopover.jsx — shared "?" popover component
 *
 * Renders a small circular "?" button that opens a floating explanation bubble
 * via a React portal so it is never clipped by overflow:hidden parents.
 * Position is calculated from getBoundingClientRect and flips above/below
 * when close to a viewport edge.
 *
 * Usage:
 *   <InfoPopover>
 *     <strong>Net Worth</strong> is property value minus outstanding loans.
 *   </InfoPopover>
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const BUBBLE_W = 256   // matches w-64
const BUBBLE_H = 220   // generous estimate; actual height varies
const GAP      = 8     // px between button and bubble
const ARROW    = 8     // arrow height

export default function InfoPopover({ children }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0, placement: 'top' })
  const btnRef          = useRef(null)
  const bubbleRef       = useRef(null)

  const reposition = useCallback(() => {
    if (!btnRef.current) return
    const r      = btnRef.current.getBoundingClientRect()
    const vw     = window.innerWidth
    const vh     = window.innerHeight
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    const spaceAbove = r.top
    const spaceBelow = vh - r.bottom
    const placement  = spaceAbove >= BUBBLE_H + GAP + ARROW || spaceAbove >= spaceBelow
      ? 'top'
      : 'bottom'

    let left = r.left + scrollX + r.width / 2 - BUBBLE_W / 2
    left = Math.max(8, Math.min(left, scrollX + vw - BUBBLE_W - 8))

    const top = placement === 'top'
      ? r.top  + scrollY - BUBBLE_H - GAP - ARROW
      : r.bottom + scrollY + GAP + ARROW

    setPos({ top, left, placement })
  }, [])

  const bubbleCallbackRef = useCallback((node) => {
    bubbleRef.current = node
    if (!node || !btnRef.current) return
    const r      = btnRef.current.getBoundingClientRect()
    const vh     = window.innerHeight
    const vw     = window.innerWidth
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    const actualH = node.offsetHeight

    const spaceAbove = r.top
    const spaceBelow = vh - r.bottom
    const placement  = spaceAbove >= actualH + GAP + ARROW || spaceAbove >= spaceBelow
      ? 'top'
      : 'bottom'

    let left = r.left + scrollX + r.width / 2 - BUBBLE_W / 2
    left = Math.max(8, Math.min(left, scrollX + vw - BUBBLE_W - 8))

    const top = placement === 'top'
      ? r.top  + scrollY - actualH - GAP - ARROW
      : r.bottom + scrollY + GAP + ARROW

    setPos({ top, left, placement })
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        bubbleRef.current && !bubbleRef.current.contains(e.target)
      ) setOpen(false)
    }
    const closeImmediate = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeImmediate, true)
    window.addEventListener('resize', closeImmediate)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeImmediate, true)
      window.removeEventListener('resize', closeImmediate)
    }
  }, [open])

  const handleClick = (e) => {
    e.stopPropagation()
    if (!open) reposition()
    setOpen((v) => !v)
  }

  const arrowStyle = pos.placement === 'top'
    ? { bottom: -ARROW, left: '50%', transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderTop: `${ARROW}px solid #64748b` }
    : { top: -ARROW, left: '50%', transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderBottom: `${ARROW}px solid #64748b` }

  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className="w-4 h-4 rounded-full bg-slate-600 hover:bg-brand-600 text-slate-300
                   hover:text-white flex items-center justify-center transition-colors
                   text-[10px] font-bold leading-none shrink-0"
        aria-label="Show explanation"
      >
        ?
      </button>

      {open && createPortal(
        <div
          ref={bubbleCallbackRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: BUBBLE_W, zIndex: 9999 }}
          className="bg-slate-700 border border-slate-500 rounded-xl p-3 shadow-2xl
                     text-xs text-slate-200 leading-relaxed"
        >
          <span style={{ position: 'absolute', width: 0, height: 0, ...arrowStyle }} />
          {children}
        </div>,
        document.body
      )}
    </span>
  )
}
