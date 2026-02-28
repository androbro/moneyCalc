import { useState } from 'react'

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',        icon: ChartIcon,      group: 'portfolio' },
  { id: 'properties',  label: 'Properties',       icon: BuildingIcon,   group: 'portfolio' },
  { id: 'investments', label: 'Investments',      icon: InvestmentIcon, group: 'portfolio' },
  { id: 'projection',  label: 'Projection',       icon: TrendingIcon,   group: 'portfolio' },
  { id: 'scenario',    label: 'Scenarios',        icon: ScenarioIcon,   group: 'portfolio' },
  { id: 'household',   label: 'Household Profile',icon: HouseholdIcon,  group: 'strategy' },
  { id: 'cashflow',    label: 'Cash Flow',        icon: CashFlowIcon,   group: 'strategy' },
  { id: 'moneyflow',   label: 'Money Flow',       icon: MoneyFlowIcon,  group: 'strategy' },
  { id: 'simulator',   label: 'Simulator',        icon: SimulatorIcon,  group: 'strategy' },
]

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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function InvestmentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 14l-7 7m0 0l-7-7m7 7V3" />
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

function AiIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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

export default function Layout({ activeTab, onTabChange, children, isOwner, onOpenAuth }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNav = (id) => {
    onTabChange(id)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:w-56 lg:w-64 flex-col bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-20">
        <SidebarContent active={activeTab} onNav={handleNav} isOwner={isOwner} onOpenAuth={onOpenAuth} />
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800
                    transform transition-transform duration-300 md:hidden
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100"
          onClick={() => setMobileOpen(false)}
        >
          <CloseIcon />
        </button>
        <SidebarContent active={activeTab} onNav={handleNav} isOwner={isOwner} onOpenAuth={onOpenAuth} />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 md:ml-56 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
          <button
            className="text-slate-400 hover:text-slate-100"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
          <span className="font-semibold text-white flex-1">MoneyCalc</span>
          {/* Mobile auth button */}
          <button
            onClick={onOpenAuth}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                        transition-colors border
                        ${isOwner
                          ? 'border-emerald-700/40 text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40'
                          : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title={isOwner ? 'Owner mode — click to manage' : 'Guest mode — click to log in'}
          >
            {isOwner ? <UnlockIconSm /> : <LockIconSm />}
            {isOwner ? 'Owner' : 'Guest'}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

const NAV_GROUPS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'strategy',  label: 'Strategy & AI' },
]

function SidebarContent({ active, onNav, isOwner, onOpenAuth }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-white leading-tight">MoneyCalc</p>
            <p className="text-xs text-slate-400">Real Estate Tracker</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group.id)
          return (
            <div key={group.id}>
              <p className="px-3 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => onNav(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                transition-colors text-left
                                ${active === id
                                  ? 'bg-brand-600 text-white'
                                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                  >
                    <Icon />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer — auth status + lock button */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-2">
        <button
          onClick={onOpenAuth}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm
                      font-medium transition-colors border
                      ${isOwner
                        ? 'border-emerald-700/40 text-emerald-300 bg-emerald-900/10 hover:bg-emerald-900/20'
                        : 'border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
        >
          {isOwner ? <UnlockIconSm /> : <LockIconSm />}
          <span>{isOwner ? 'Owner mode' : 'Guest mode'}</span>
          <span className="ml-auto text-[10px] text-slate-500">
            {isOwner ? 'click to manage' : 'click to log in'}
          </span>
        </button>
        <p className="text-xs text-slate-600 px-1">
          {isOwner ? 'Writes go to Supabase' : 'Writes stay in local storage'}
        </p>
      </div>
    </div>
  )
}

function LockIconSm() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function UnlockIconSm() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  )
}
