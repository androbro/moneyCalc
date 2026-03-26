/**
 * DashboardSettingsPanel — slide-in panel for toggling and resetting widgets.
 *
 * Opens when the user taps the gear icon in the Dashboard header.
 * Responsibilities (Single Responsibility: settings UI only):
 *   - Show all widgets grouped by category with toggle switches
 *   - "Reset to defaults" button restores factory layout
 *   - Saves changes immediately to profile
 */

import { AnimatePresence, motion } from 'motion/react'
import { WIDGET_REGISTRY, getDefaultLayouts, getWidgetsByCategory } from './widgetRegistry'
import { SOFT_EASE } from './utils/constants'

const CATEGORY_LABELS = {
  overview: 'Overview',
  cashflow: 'Cash Flow',
  planning: 'Planning',
  personal: 'Personal',
}

const CATEGORY_COLORS = {
  overview: 'text-brand-400',
  cashflow: 'text-emerald-400',
  planning: 'text-amber-400',
  personal: 'text-blue-400',
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   profile: Object,
 *   onSaveProfile: Function,
 * }} props
 */
export default function DashboardSettingsPanel({ open, onClose, profile, onSaveProfile }) {
  const currentLayout = profile?.dashboardLayout ?? getDefaultLayouts()
  const hiddenIds     = currentLayout.hidden ?? []
  const widgetsByCategory = getWidgetsByCategory()

  function toggleWidget(id) {
    const isHidden = hiddenIds.includes(id)
    const nextHidden = isHidden ? hiddenIds.filter(h => h !== id) : [...hiddenIds, id]
    onSaveProfile({ ...profile, dashboardLayout: { ...currentLayout, hidden: nextHidden } })
  }

  function resetToDefaults() {
    onSaveProfile({ ...profile, dashboardLayout: getDefaultLayouts() })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-80 flex flex-col border-l border-white/[0.08]"
            style={{ background: 'rgba(8, 12, 22, 0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: SOFT_EASE }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div>
                <h2 className="font-semibold text-neo-text">Dashboard Widgets</h2>
                <p className="text-xs text-neo-subtle mt-0.5">Toggle visibility · drag to reorder on desktop</p>
              </div>
              <button onClick={onClose} className="text-neo-subtle hover:text-neo-text transition-colors w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/[0.06]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Widget list */}
            <div className="flex-1 overflow-auto px-5 py-4 space-y-6">
              {Object.entries(widgetsByCategory).map(([category, configs]) => (
                <div key={category}>
                  <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${CATEGORY_COLORS[category] ?? 'text-neo-muted'}`}>
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  <div className="space-y-1">
                    {configs.map((config) => {
                      const isVisible = !hiddenIds.includes(config.id)
                      return (
                        <motion.div
                          key={config.id}
                          className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
                          whileHover={{ x: 2 }}
                          transition={{ duration: 0.15 }}
                        >
                          {/* Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleWidget(config.id)}
                            className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 mt-0.5
                              ${isVisible ? 'bg-brand-500' : 'bg-white/[0.12]'}`}
                            aria-label={`${isVisible ? 'Disable' : 'Enable'} ${config.title}`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                                ${isVisible ? 'translate-x-4' : 'translate-x-0.5'}`}
                            />
                          </button>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium leading-snug ${isVisible ? 'text-neo-text' : 'text-neo-subtle'}`}>
                              {config.title}
                            </p>
                            <p className="text-xs text-neo-icon mt-0.5 leading-relaxed">{config.description}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
              <button
                onClick={resetToDefaults}
                className="w-full text-sm text-neo-muted hover:text-neo-text border border-white/[0.10] hover:border-white/[0.18] rounded-xl py-2 transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
