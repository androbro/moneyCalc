import { useState } from 'react'

// ─── Tab groups for bottom bar (primary tabs) + overflow menu ─────────────────

const PRIMARY_TABS = [
  { id: 'dashboard',   label: 'Home',       icon: HomeIcon },
  { id: 'properties',  label: 'Properties', icon: BuildingIcon },
  { id: 'cashflow',    label: 'Cash Flow',  icon: CashFlowIcon },
  { id: 'projection',  label: 'Forecast',   icon: TrendingIcon },
  { id: 'more',        label: 'More',       icon: MoreIcon },
]

const ALL_TABS = [
  { id: 'dashboard',   label: 'Dashboard',         group: 'portfolio' },
  { id: 'properties',  label: 'Properties',         group: 'portfolio' },
  { id: 'investments', label: 'Investments',         group: 'portfolio' },
  { id: 'projection',  label: 'Projection',          group: 'portfolio' },
  { id: 'scenario',    label: 'Scenarios',           group: 'portfolio' },
  { id: 'trading',     label: 'Trading',             group: 'portfolio' },
  { id: 'household',   label: 'Household Profile',   group: 'strategy' },
  { id: 'cashflow',    label: 'Cash Flow',           group: 'strategy' },
  { id: 'moneyflow',   label: 'Money Flow',          group: 'strategy' },
  { id: 'simulator',   label: 'Simulator',           group: 'strategy' },
  { id: 'growth',      label: 'Growth Planner',      group: 'strategy' },
]

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}
function CashFlowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function TrendingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── More overlay (fullscreen blurred) ────────────────────────────────────────

function MoreOverlay({ active, onNav, isLoggedIn, user, onSignOut, onResetDemo, onClose }) {
  const portfolio = ALL_TABS.filter(t => t.group === 'portfolio')
  const strategy  = ALL_TABS.filter(t => t.group === 'strategy')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-all duration-300"
      style={{ background: 'rgba(4, 7, 14, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand-600 flex items-center justify-center sidebar-logo-pulse"
               style={{ boxShadow: '0 0 16px rgba(234,88,12,0.5)' }}>
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-neo-text text-sm leading-tight">MoneyCalc</p>
            <p className="text-[11px] text-neo-muted">Real Estate Tracker</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-neo-muted hover:text-neo-text transition-colors"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
        <p className="text-[9px] text-neo-subtle uppercase tracking-widest px-2 mb-2 mt-2 opacity-70">Portfolio</p>
        {portfolio.map(({ id, label }, idx) => (
          <button
            key={id}
            onClick={() => { onNav(id); onClose() }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200"
            style={active === id
              ? { background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.28)', color: '#fb923c', animation: `navFadeIn 0.2s ease-out ${idx * 30}ms both` }
              : { border: '1px solid transparent', color: '#8897b5', animation: `navFadeIn 0.2s ease-out ${idx * 30}ms both` }}
          >
            {label}
            {active === id && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" style={{ boxShadow: '0 0 6px rgba(234,88,12,0.8)' }} />}
          </button>
        ))}

        <div className="h-px mx-2 my-3" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <p className="text-[9px] text-neo-subtle uppercase tracking-widest px-2 mb-2 opacity-70">Strategy</p>
        {strategy.map(({ id, label }, idx) => (
          <button
            key={id}
            onClick={() => { onNav(id); onClose() }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200"
            style={active === id
              ? { background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.28)', color: '#fb923c', animation: `navFadeIn 0.2s ease-out ${(idx + 6) * 30}ms both` }
              : { border: '1px solid transparent', color: '#8897b5', animation: `navFadeIn 0.2s ease-out ${(idx + 6) * 30}ms both` }}
          >
            {label}
            {active === id && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" style={{ boxShadow: '0 0 6px rgba(234,88,12,0.8)' }} />}
          </button>
        ))}

        <div className="h-px mx-2 my-3" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <p className="text-[9px] text-neo-subtle uppercase tracking-widest px-2 mb-2 opacity-70">Account</p>
        <button
          onClick={() => { onNav('household'); onClose() }}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200"
          style={active === 'household'
            ? { background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.28)', color: '#fb923c' }
            : { border: '1px solid transparent', color: '#8897b5' }}
        >
          Profile Settings
          {active === 'household' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" style={{ boxShadow: '0 0 6px rgba(234,88,12,0.8)' }} />}
        </button>
      </div>

      {/* Bottom: sign in or user actions */}
      <div className="px-4 pb-8 pt-3 border-t space-y-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {!user && (
          <button
            onClick={() => { window.history.pushState(null, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')); onClose() }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 0 20px rgba(234,88,12,0.35)', color: '#fff' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign in
          </button>
        )}
        <button
          onClick={user ? onSignOut : onResetDemo}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold
            ${user ? 'bg-brand-600 text-white' : 'text-neo-subtle'}`}
               style={user ? { boxShadow: '0 0 10px rgba(234,88,12,0.35)' } : {}}>
            {user
              ? (user.email ?? '').slice(0, 2).toUpperCase()
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            }
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-red-400">{user ? 'Sign out' : 'Reset Demo'}</p>
            <p className="text-[10px] text-neo-subtle">{user ? user.email : 'Clear sample data'}</p>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Mobile Layout ─────────────────────────────────────────────────────────────

// Left 2 tabs and right 2 tabs — AI button goes in the center
const LEFT_TABS  = [
  { id: 'dashboard',  label: 'Home',       icon: HomeIcon },
  { id: 'properties', label: 'Properties', icon: BuildingIcon },
]
const RIGHT_TABS = [
  { id: 'cashflow',   label: 'Cash Flow',  icon: CashFlowIcon },
  { id: 'more',       label: 'More',       icon: MoreIcon },
]

function NavTab({ id, label, Icon, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200 relative"
    >
      <div className="transition-all duration-200"
           style={{ color: isActive ? '#fb923c' : '#4a5b7a', transform: isActive ? 'scale(1.15)' : 'scale(1)' }}>
        <Icon />
      </div>
      <span className="text-[9px] font-medium transition-colors duration-200"
            style={{ color: isActive ? '#fb923c' : '#4a5b7a' }}>
        {label}
      </span>
      {isActive && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
              style={{ background: '#ea580c', boxShadow: '0 0 8px rgba(234,88,12,0.8)' }} />
      )}
    </button>
  )
}

export default function MobileLayout({ activeTab, onTabChange, children, isLoggedIn, user, onSignOut, onResetDemo, aiChatOpen, onAiChatToggle }) {
  const [showMore, setShowMore] = useState(false)

  const handleNav = (id) => {
    onTabChange(id)
    setShowMore(false)
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* Content — hidden when AI chat is open so it's a clean full screen */}
      {!aiChatOpen && (
        <main className="flex-1 overflow-y-auto px-4 pt-5 pb-24 space-y-4">
          {children}
        </main>
      )}

      {/* Bottom tab bar with center AI FAB */}
      <nav
        className="fixed bottom-0 inset-x-0 z-[100] flex items-stretch border-t"
        style={{
          background: 'rgba(6, 10, 20, 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Left tabs */}
        {LEFT_TABS.map(({ id, label, icon: Icon }) => (
          <NavTab key={id} id={id} label={label} Icon={Icon}
                  isActive={activeTab === id} onClick={() => handleNav(id)} />
        ))}

        {/* Center AI button — protrudes above navbar */}
        <div className="flex-1 flex flex-col items-center justify-end pb-2 relative">
          <button
            onClick={onAiChatToggle}
            className="absolute -top-5 w-12 h-12 rounded-full flex items-center justify-center
                       transition-all duration-200 active:scale-95"
            style={{
              background: aiChatOpen
                ? 'rgba(4,7,14,0.9)'
                : 'linear-gradient(135deg, #ea580c, #c2410c)',
              boxShadow: aiChatOpen
                ? '0 0 0 2px rgba(234,88,12,0.4), 0 4px 20px rgba(0,0,0,0.5)'
                : '0 0 24px rgba(234,88,12,0.6), 0 4px 20px rgba(0,0,0,0.4), 0 0 0 3px rgba(6,10,20,0.88)',
              border: aiChatOpen ? '1px solid rgba(234,88,12,0.3)' : 'none',
              transform: aiChatOpen ? 'rotate(45deg)' : 'none',
            }}
          >
            {aiChatOpen ? (
              <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
          </button>
          <span className="text-[9px] font-medium mt-0.5" style={{ color: aiChatOpen ? '#fb923c' : '#4a5b7a' }}>AI</span>
        </div>

        {/* Right tabs */}
        {RIGHT_TABS.map(({ id, label, icon: Icon }) => (
          <NavTab key={id} id={id} label={label} Icon={Icon}
                  isActive={id === 'more' ? showMore : activeTab === id}
                  onClick={() => id === 'more' ? setShowMore(true) : handleNav(id)} />
        ))}
      </nav>

      {/* More overlay */}
      {showMore && (
        <MoreOverlay
          active={activeTab}
          onNav={handleNav}
          isLoggedIn={isLoggedIn}
          user={user}
          onSignOut={onSignOut}
          onResetDemo={onResetDemo}
          onClose={() => setShowMore(false)}
        />
      )}
    </div>
  )
}
