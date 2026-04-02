import { useState, useRef, useEffect } from 'react'

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',  fullLabel: 'Dashboard',         icon: ChartIcon,         group: 'portfolio' },
  { id: 'properties',  label: 'Properties', fullLabel: 'Properties',        icon: BuildingIcon,      group: 'portfolio' },
  { id: 'investments', label: 'Invest',     fullLabel: 'Investments',       icon: InvestmentIcon,    group: 'portfolio' },
  { id: 'projection',  label: 'Projection', fullLabel: 'Projection',        icon: TrendingIcon,      group: 'portfolio' },
  { id: 'scenario',    label: 'Scenarios',  fullLabel: 'Scenarios',         icon: ScenarioIcon,      group: 'portfolio' },
  { id: 'trading',     label: 'Trading',    fullLabel: 'Trading',           icon: TradingIcon,       group: 'portfolio' },
  { id: 'household',   label: 'Household',  fullLabel: 'Household Profile', icon: HouseholdIcon,     group: 'strategy' },
  { id: 'cashflow',    label: 'Cash Flow',  fullLabel: 'Cash Flow',         icon: CashFlowIcon,      group: 'strategy' },
  { id: 'moneyflow',   label: 'Money',      fullLabel: 'Money Flow',        icon: MoneyFlowIcon,     group: 'strategy' },
  { id: 'simulator',   label: 'Simulator',  fullLabel: 'Simulator',         icon: SimulatorIcon,     group: 'strategy' },
  { id: 'growth',      label: 'Growth',     fullLabel: 'Growth Planner',    icon: GrowthPlannerIcon, group: 'strategy' },
]

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
function TrendingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}
function InvestmentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}
function ScenarioIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function HouseholdIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
function MoneyFlowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
}
function SimulatorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  )
}
function GrowthPlannerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}
function TradingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── Animated NavPill (desktop) ──────────────────────────────────────────────

function NavPill({ id, label, fullLabel, Icon, active, onNav, index = 0 }) {
  const isActive = active === id
  return (
    <div
      className="relative w-full group/pill"
      style={{ animation: `navFadeIn 0.3s ease-out ${index * 35}ms both` }}
    >
      <button
        onClick={() => onNav(id)}
        className="w-full flex flex-col items-center gap-1 py-1.5 px-1 rounded-2xl transition-all duration-200"
        style={isActive
          ? { background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.28)' }
          : { border: '1px solid transparent' }}
      >
        {/* Icon box */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center
                      transition-all duration-200
                      group-hover/pill:scale-110
                      ${isActive ? '' : 'text-neo-subtle group-hover/pill:text-neo-text'}`}
          style={isActive ? {
            background: 'linear-gradient(135deg, #ea580c, #c2410c)',
            boxShadow: '0 0 14px rgba(234,88,12,0.55)',
            color: '#fff',
          } : {}}
        >
          <Icon />
        </div>
        {/* Short label */}
        <span className={`text-[9px] leading-tight font-medium transition-colors truncate w-full text-center
          ${isActive ? 'text-brand-400' : 'text-neo-subtle group-hover/pill:text-neo-muted'}`}>
          {label}
        </span>
      </button>

      {/* Hover tooltip — slides in from the right */}
      <div
        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60]
                   opacity-0 -translate-x-2
                   group-hover/pill:opacity-100 group-hover/pill:translate-x-0
                   transition-all duration-200"
      >
        <div
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neo-text whitespace-nowrap"
          style={{
            background: 'rgba(8,12,22,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {fullLabel}
          {/* Arrow */}
          <span
            className="absolute right-full top-1/2 -translate-y-1/2"
            style={{ borderRight: '5px solid rgba(8,12,22,0.92)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', width: 0, height: 0 }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Floating narrow sidebar (desktop) ────────────────────────────────────────

function FloatingSidebar({ active, onNav, isLoggedIn, user, onSignOut, onResetDemo, onShare }) {
  return (
    <div className="flex flex-col h-full py-4 px-2.5">

      {/* Logo — pulsing glow */}
      <div className="flex justify-center mb-5 shrink-0">
        <div
          className="w-11 h-11 rounded-2xl bg-brand-600 flex items-center justify-center sidebar-logo-pulse"
          style={{ boxShadow: '0 0 18px rgba(234,88,12,0.55)' }}
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </div>
      </div>

      {/* Group: Portfolio */}
      <p className="text-[8px] text-neo-subtle uppercase tracking-widest text-center mb-1.5 opacity-60 shrink-0">
        Portfolio
      </p>
      <nav className="flex flex-col items-center gap-0.5 shrink-0">
        {NAV_ITEMS.filter(i => i.group === 'portfolio').map(({ id, label, fullLabel, icon: Icon }, idx) => (
          <NavPill key={id} id={id} label={label} fullLabel={fullLabel} Icon={Icon} active={active} onNav={onNav} index={idx} />
        ))}
      </nav>

      {/* Divider + Group: Strategy */}
      <div className="w-8 h-px bg-white/10 my-2 mx-auto shrink-0" />
      <p className="text-[8px] text-neo-subtle uppercase tracking-widest text-center mb-1.5 opacity-60 shrink-0">
        Strategy
      </p>
      <nav className="flex flex-col items-center gap-0.5 flex-1">
        {NAV_ITEMS.filter(i => i.group === 'strategy').map(({ id, label, fullLabel, icon: Icon }, idx) => (
          <NavPill key={id} id={id} label={label} fullLabel={fullLabel} Icon={Icon} active={active} onNav={onNav} index={idx + 6} />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-0.5 pt-3 border-t border-white/[0.07]">
        {!isLoggedIn && (
          <div className="relative w-full group/login">
            <button
              onClick={() => { window.history.pushState(null,'','/login'); window.dispatchEvent(new PopStateEvent('popstate')) }}
              className="w-full flex flex-col items-center gap-1 py-2 rounded-2xl border border-transparent
                         hover:bg-brand-500/10 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-brand-400
                              group-hover/login:text-brand-300 group-hover/login:scale-110 transition-all duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <span className="text-[8px] text-brand-400 group-hover/login:text-brand-300 transition-colors">Sign In</span>
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60]
                           opacity-0 -translate-x-2 group-hover/login:opacity-100 group-hover/login:translate-x-0
                           transition-all duration-200">
              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-300 whitespace-nowrap"
                   style={{ background: 'rgba(8,12,22,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(234,88,12,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                Sign In / Register
              </div>
            </div>
          </div>
        )}
        {isLoggedIn && (
          <div className="relative w-full group/share">
            <button
              onClick={onShare}
              className="w-full flex flex-col items-center gap-1 py-2 rounded-2xl border border-transparent
                         hover:bg-white/[0.06] transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-neo-subtle
                              group-hover/share:text-neo-text group-hover/share:scale-110 transition-all duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <span className="text-[8px] text-neo-subtle group-hover/share:text-neo-muted transition-colors">Share</span>
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60]
                           opacity-0 -translate-x-2 group-hover/share:opacity-100 group-hover/share:translate-x-0
                           transition-all duration-200">
              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neo-text whitespace-nowrap"
                   style={{ background: 'rgba(8,12,22,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                Share Portfolio
              </div>
            </div>
          </div>
        )}
        <div className="relative w-full group/logout">
          <button
            onClick={user ? onSignOut : onResetDemo}
            className="w-full flex flex-col items-center gap-1 py-2 rounded-2xl border border-transparent
                       hover:bg-red-500/10 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-neo-subtle
                            group-hover/logout:text-red-400 group-hover/logout:scale-110 transition-all duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="text-[8px] text-neo-subtle group-hover/logout:text-red-400 transition-colors">
              {user ? 'Logout' : 'Reset'}
            </span>
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60]
                         opacity-0 -translate-x-2 group-hover/logout:opacity-100 group-hover/logout:translate-x-0
                         transition-all duration-200">
            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 whitespace-nowrap"
                 style={{ background: 'rgba(8,12,22,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              {user ? 'Sign Out' : 'Reset Demo'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile floating sidebar ─────────────────────────────────────────────────

function MobileNavItem({ id, label, fullLabel, Icon, active, onNav, danger = false }) {
  const isActive = active === id
  return (
    <button
      onClick={() => onNav(id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium
                 transition-all duration-200 text-left group"
      style={isActive
        ? { background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.28)' }
        : { border: '1px solid transparent' }}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200
                    group-hover:scale-110
                    ${isActive ? '' : danger ? 'text-red-400/60 group-hover:text-red-400' : 'text-neo-subtle group-hover:text-neo-text'}`}
        style={isActive ? {
          background: 'linear-gradient(135deg, #ea580c, #c2410c)',
          color: '#fff',
          boxShadow: '0 0 12px rgba(234,88,12,0.45)',
        } : {}}
      >
        <Icon />
      </div>
      <span className={`transition-colors ${isActive ? 'text-brand-400' : danger ? 'text-red-400/60 group-hover:text-red-400' : 'text-neo-muted group-hover:text-neo-text'}`}>
        {fullLabel}
      </span>
      {isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"
              style={{ boxShadow: '0 0 6px rgba(234,88,12,0.8)' }} />
      )}
    </button>
  )
}

function MobileFloatingSidebar({ active, onNav, isLoggedIn, user, onSignOut, onResetDemo, onShare }) {
  return (
    <div className="flex flex-col h-full py-5 px-3">

      {/* Logo + title */}
      <div className="flex items-center gap-3 px-2 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center shrink-0 sidebar-logo-pulse"
             style={{ boxShadow: '0 0 16px rgba(234,88,12,0.5)' }}>
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-neo-text leading-tight">MoneyCalc</p>
          <p className="text-[11px] text-neo-muted">Real Estate Tracker</p>
        </div>
      </div>

      {/* Guest banner */}
      {!isLoggedIn && (
        <div className="mx-1 mb-3 rounded-2xl border border-white/[0.07] px-3 py-2.5"
             style={{ background: 'rgba(234,88,12,0.07)' }}>
          <p className="text-xs font-medium text-neo-muted">Demo mode</p>
          <p className="text-[11px] text-neo-subtle mt-0.5">
            <button
              onClick={() => { window.history.pushState(null,'','/login'); window.dispatchEvent(new PopStateEvent('popstate')) }}
              className="text-brand-400 hover:text-brand-300 font-medium"
            >Sign in
            </button>{' '}to access your portfolio.
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto space-y-0.5">
        <p className="text-[9px] text-neo-subtle uppercase tracking-widest px-3 mb-2 opacity-70">Portfolio</p>
        {NAV_ITEMS.filter(i => i.group === 'portfolio').map(({ id, label, fullLabel, icon: Icon }, idx) => (
          <div key={id} style={{ animation: `navFadeIn 0.25s ease-out ${idx * 30}ms both` }}>
            <MobileNavItem id={id} label={label} fullLabel={fullLabel} Icon={Icon} active={active} onNav={onNav} />
          </div>
        ))}
        <div className="h-px bg-white/[0.07] mx-3 my-2" />
        <p className="text-[9px] text-neo-subtle uppercase tracking-widest px-3 mb-2 opacity-70">Strategy</p>
        {NAV_ITEMS.filter(i => i.group === 'strategy').map(({ id, label, fullLabel, icon: Icon }, idx) => (
          <div key={id} style={{ animation: `navFadeIn 0.25s ease-out ${(idx + 6) * 30}ms both` }}>
            <MobileNavItem id={id} label={label} fullLabel={fullLabel} Icon={Icon} active={active} onNav={onNav} />
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="pt-3 border-t border-white/[0.07] space-y-0.5">
        {isLoggedIn && (
          <button
            onClick={onShare}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium
                       text-neo-muted border border-transparent hover:bg-white/[0.05] hover:text-neo-text
                       transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-neo-subtle
                            group-hover:text-neo-text group-hover:scale-110 transition-all duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            Share Portfolio
          </button>
        )}
        {/* User / logout row */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-transparent
                        hover:bg-red-500/10 transition-all duration-200 group cursor-pointer"
             onClick={user ? onSignOut : onResetDemo}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-110
            ${user ? 'bg-brand-600 text-white text-xs font-bold' : 'text-neo-subtle group-hover:text-red-400'}`}
               style={user ? { boxShadow: '0 0 10px rgba(234,88,12,0.35)' } : {}}>
            {user
              ? (user.email ?? '').slice(0, 2).toUpperCase()
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neo-muted group-hover:text-red-400 transition-colors truncate">
              {user ? (user.email ?? 'Account') : 'Reset Demo'}
            </p>
            <p className="text-[10px] text-neo-subtle">{user ? 'Tap to sign out' : 'Clear sample data'}</p>
          </div>
          <svg className="w-4 h-4 text-neo-subtle group-hover:text-red-400 transition-colors shrink-0"
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Desktop Layout ───────────────────────────────────────────────────────────

export default function Layout({ activeTab, onTabChange, children, isLoggedIn, user, onSignOut, onResetDemo, onShare }) {
  const handleNav = (id) => onTabChange(id)

  return (
    <div className="min-h-screen flex">

      {/* Floating sidebar */}
      <aside
        className="flex flex-col fixed left-3 top-3 bottom-3 w-[82px] z-20 rounded-3xl border border-white/[0.10]"
        style={{
          background: 'rgba(6, 10, 20, 0.70)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <FloatingSidebar
          active={activeTab}
          onNav={handleNav}
          isLoggedIn={isLoggedIn}
          user={user}
          onSignOut={onSignOut}
          onResetDemo={onResetDemo}
          onShare={onShare}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-[98px] flex flex-col min-h-screen">
        <main className="flex-1 p-5 lg:p-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
