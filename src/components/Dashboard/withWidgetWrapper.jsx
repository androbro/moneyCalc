/**
 * withWidgetWrapper — HOC that wraps every widget with consistent chrome:
 *   - GlowCard frame
 *   - .widget-drag-handle header bar (used by react-grid-layout draggableHandle)
 *   - Scrollable content area
 *
 * Usage in widgetRegistry.js:
 *   registry['cash_flow'] = {
 *     config: widgetConfig,
 *     Component: withWidgetWrapper(CashFlowWidget, widgetConfig),
 *   }
 *
 * Widget components themselves only render their content — no chrome needed.
 *
 * @param {React.ComponentType}  WidgetComponent - The unwrapped widget component
 * @param {import('./WidgetConfig').WidgetConfig} config - Widget metadata
 * @returns {React.ComponentType}
 */

import GlowCard from './components/GlowCard'

const CATEGORY_COLORS = {
  overview: 'text-brand-400',
  cashflow: 'text-emerald-400',
  planning: 'text-amber-400',
  personal: 'text-blue-400',
}

export function withWidgetWrapper(WidgetComponent, config) {
  function WrappedWidget(props) {
    const categoryClass = CATEGORY_COLORS[config.category] ?? 'text-neo-muted'

    return (
      <GlowCard
        className="card h-full flex flex-col overflow-hidden !p-0"
        glowSize={200}
        glowOpacity={0.12}
      >
        {/* Drag handle — the only draggable area */}
        <div
          className="widget-drag-handle flex items-center justify-between gap-2 px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing select-none shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-neo-text truncate">{config.title}</span>
            <span className={`text-[10px] uppercase tracking-wider font-medium ${categoryClass} shrink-0`}>
              {config.category}
            </span>
          </div>
          {/* Drag affordance dots */}
          <div className="flex gap-0.5 shrink-0 opacity-30">
            {[0,1,2].map(i => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="w-1 h-1 rounded-full bg-neo-muted" />
                <div className="w-1 h-1 rounded-full bg-neo-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable widget content */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <WidgetComponent {...props} />
        </div>
      </GlowCard>
    )
  }

  WrappedWidget.displayName = `WithWidgetWrapper(${WidgetComponent.displayName || WidgetComponent.name || 'Widget'})`
  return WrappedWidget
}
