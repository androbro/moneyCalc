/**
 * EmptyState — shown when no properties exist yet.
 */

export default function EmptyState({ onAddProperty }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="card text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto mb-4 text-brand-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neo-text mb-2">No Properties Yet</h2>
        <p className="text-neo-muted text-sm mb-5">
          Add your first property to see your portfolio dashboard.
        </p>
        <button onClick={onAddProperty} className="btn-primary w-full flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Property
        </button>
      </div>
    </div>
  )
}
