/**
 * DashboardGrid — renders the widget grid using react-grid-layout.
 *
 * Responsibilities (Single Responsibility: layout only):
 *   - Read layout from profile.dashboardLayout (or seed from registry defaults)
 *   - Render each enabled widget inside a grid cell
 *   - Save layout changes (drag/resize) back to profile with debouncing
 *   - On mobile (xs), disable drag/resize for better touch UX
 *
 * Does NOT compute data — receives pre-computed `ctx` from Dashboard.jsx.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WIDGET_REGISTRY, getDefaultLayouts } from './widgetRegistry'

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 0 }
const COLS        = { lg: 12, md: 8, sm: 4, xs: 4 }
const ROW_HEIGHT  = 60
const SAVE_DELAY  = 800  // ms debounce before persisting layout changes

/**
 * @param {{
 *   ctx: import('./interfaces').DashboardContext,
 *   onSaveProfile: Function,
 * }} props
 */
export default function DashboardGrid({ ctx, onSaveProfile }) {
  const { profile } = ctx
  const saveTimerRef = useRef(null)
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 })

  // ── Initialise / seed layout ───────────────────────────────
  const [layouts, setLayouts] = useState(() => {
    const saved = profile?.dashboardLayout
    if (saved?.lg?.length) return saved
    return getDefaultLayouts()
  })

  const hiddenIds = layouts.hidden ?? []

  // Sync if profile changes externally (e.g. guest→auth upgrade)
  useEffect(() => {
    if (profile?.dashboardLayout?.lg?.length) {
      setLayouts(profile.dashboardLayout)
    }
  }, [profile?.dashboardLayout])

  // ── Layout change handler (drag/resize) ───────────────────
  const handleLayoutChange = useCallback((_layout, allLayouts) => {
    const next = { ...allLayouts, hidden: hiddenIds }
    setLayouts(next)

    // Debounce the profile save to avoid too many Supabase writes
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (onSaveProfile && profile) {
        onSaveProfile({ ...profile, dashboardLayout: next })
      }
    }, SAVE_DELAY)
  }, [hiddenIds, onSaveProfile, profile])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // ── Detect mobile for simplified layout ───────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINTS.sm)
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < BREAKPOINTS.sm) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Render ─────────────────────────────────────────────────
  const visibleIds = Object.keys(WIDGET_REGISTRY).filter((id) => !hiddenIds.includes(id))

  // Build layout arrays for each breakpoint, filtered to visible widgets
  const filteredLayouts = Object.fromEntries(
    Object.entries(layouts)
      .filter(([key]) => key !== 'hidden')
      .map(([bp, items]) => [
        bp,
        (items || []).filter((item) => visibleIds.includes(item.i)),
      ])
  )

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <ResponsiveGridLayout
        width={containerWidth ?? 1200}
        className="layout"
        layouts={filteredLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        draggableHandle=".widget-drag-handle"
        isDraggable={!isMobile}
        isResizable={!isMobile}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
        resizeHandles={['se', 'sw']}
      >
        {visibleIds.map((id) => {
          const entry = WIDGET_REGISTRY[id]
          if (!entry) return null
          const { Component } = entry
          return (
            <div key={id}>
              <Component ctx={ctx} />
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}
