/**
 * AiChatOverlay.jsx
 *
 * A floating, collapsible AI chat panel that sits on top of all other content.
 * - Toggle open/closed with the FAB button (bottom-right corner)
 * - Chat history is persisted in localStorage so sessions survive page reloads
 * - Multiple named sessions with the ability to start a new one or switch between them
 * - Uses the Google Gemini API (same logic as the old AiInsights tab)
 *
 * Props:
 *   properties  – current portfolio array
 *   profile     – household profile object
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { computeSummary, formatEUR, getRemainingBalance } from '../utils/projectionUtils'

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const LIST_MODELS_URL =
  `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'ai_chat_sessions'
const ACTIVE_KEY  = 'ai_chat_active_session'
const MODEL_KEY   = 'ai_chat_selected_model'

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch { /* storage full – silently ignore */ }
}

function loadActiveId() {
  return localStorage.getItem(ACTIVE_KEY) || null
}

function saveActiveId(id) {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

function loadModel() {
  return localStorage.getItem(MODEL_KEY) || ''
}

function saveModel(id) {
  if (id) localStorage.setItem(MODEL_KEY, id)
  else localStorage.removeItem(MODEL_KEY)
}

function newSession(label) {
  return {
    id:        crypto.randomUUID(),
    label:     label || `Session ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`,
    createdAt: Date.now(),
    messages:  [],
  }
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Can I afford to buy a new rental property in 2 years?',
  'What is the fastest way to save for a down payment?',
  'How much will my portfolio be worth in 10 years if I buy one more property?',
  'Am I generating positive cash flow right now?',
  'What rental yield should I target on my next property?',
  'Suggest a realistic 5-year property acquisition roadmap.',
]

// ─── Context builder ──────────────────────────────────────────────────────────

function buildFinancialContext(properties, profile) {
  const summary = computeSummary(properties)
  const fmt = formatEUR
  const today = new Date().toISOString()

  // ── Portfolio summary ──
  let portfolioBlock = `## Portfolio Summary (${properties.length} propert${properties.length === 1 ? 'y' : 'ies'})\n`
  portfolioBlock += `- Total portfolio value: ${fmt(summary.totalPortfolioValue)}\n`
  portfolioBlock += `- Total outstanding debt: ${fmt(summary.totalDebt)}\n`
  portfolioBlock += `- Net equity: ${fmt(summary.totalNetWorth)}\n`
  portfolioBlock += `- Portfolio monthly net cash flow (rental − all property costs): ${fmt(summary.totalMonthlyCashFlow)}\n`
  portfolioBlock += `- Portfolio annual net cash flow: ${fmt(summary.annualNetCashFlow)}\n`
  portfolioBlock += `- Return on equity (ROE): ${summary.roe.toFixed(2)}%\n\n`

  // ── Full detail per property ──
  for (const p of properties) {
    const monthlyRent  = p.isRented !== false ? (p.startRentalIncome || p.monthlyRentalIncome || 0) : 0
    const opexMonthly  = (
      (p.annualMaintenanceCost || 0) +
      (p.annualInsuranceCost   || 0) +
      (p.annualPropertyTax     || 0)
    ) / 12 + (p.monthlyExpenses || 0)
    const totalLoanPayment = (p.loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0)
    const totalLoanBalance = (p.loans || []).reduce((s, l) => {
      try { return s + getRemainingBalance(l, today) } catch { return s + (l.originalAmount || 0) }
    }, 0)
    const propertyCF = monthlyRent - opexMonthly - totalLoanPayment

    portfolioBlock += `### Property: "${p.name}"\n`
    if (p.address) portfolioBlock += `- Address: ${p.address}\n`
    if (p.purchasePrice) portfolioBlock += `- Purchase price: ${fmt(p.purchasePrice)}\n`
    if (p.purchaseDate)  portfolioBlock += `- Purchase date: ${p.purchaseDate}\n`
    portfolioBlock += `- Current market value: ${fmt(p.currentValue)}\n`
    portfolioBlock += `- Appreciation rate: ${((p.appreciationRate || 0.02) * 100).toFixed(1)}%/yr\n`
    portfolioBlock += `- Status: ${p.isRented !== false ? 'Rented out' : 'NOT rented (owner-occupied or vacant)'}\n`

    if (p.isRented !== false) {
      portfolioBlock += `- Gross rental income: ${fmt(monthlyRent)}/month (${fmt(monthlyRent * 12)}/year)\n`
      if (p.indexationRate) portfolioBlock += `- Rent indexation rate: ${((p.indexationRate) * 100).toFixed(1)}%/yr\n`
    }

    portfolioBlock += `\n**Operating Costs (monthly)**\n`
    portfolioBlock += `- Annual maintenance cost: ${fmt(p.annualMaintenanceCost || 0)}/yr = ${fmt((p.annualMaintenanceCost || 0) / 12)}/mo\n`
    portfolioBlock += `- Annual insurance cost: ${fmt(p.annualInsuranceCost || 0)}/yr = ${fmt((p.annualInsuranceCost || 0) / 12)}/mo\n`
    portfolioBlock += `- Annual property tax: ${fmt(p.annualPropertyTax || 0)}/yr = ${fmt((p.annualPropertyTax || 0) / 12)}/mo\n`
    if (p.monthlyExpenses) portfolioBlock += `- Other monthly expenses: ${fmt(p.monthlyExpenses)}/mo\n`
    portfolioBlock += `- **Total operating costs: ${fmt(opexMonthly)}/month**\n`

    if ((p.loans || []).length > 0) {
      portfolioBlock += `\n**Loans (${p.loans.length})**\n`
      for (const l of p.loans) {
        const balance = (() => {
          try { return getRemainingBalance(l, today) } catch { return l.originalAmount || 0 }
        })()
        portfolioBlock += `- Loan`
        if (l.lender) portfolioBlock += ` with ${l.lender}`
        portfolioBlock += `:\n`
        portfolioBlock += `  - Original amount: ${fmt(l.originalAmount || 0)}\n`
        portfolioBlock += `  - Current outstanding balance: ${fmt(balance)}\n`
        portfolioBlock += `  - Interest rate: ${((l.interestRate || 0) * 100).toFixed(2)}%/yr\n`
        portfolioBlock += `  - Monthly payment (capital + interest): ${fmt(l.monthlyPayment || 0)}\n`
        if (l.startDate)   portfolioBlock += `  - Start date: ${l.startDate}\n`
        if (l.termMonths)  portfolioBlock += `  - Term: ${l.termMonths} months (${(l.termMonths / 12).toFixed(0)} years)\n`
      }
    } else {
      portfolioBlock += `\n- No loans on this property\n`
    }

    portfolioBlock += `\n**Property Net Cash Flow**\n`
    portfolioBlock += `- Rent: ${fmt(monthlyRent)}/mo − Operating costs: ${fmt(opexMonthly)}/mo − Loan payments: ${fmt(totalLoanPayment)}/mo = **${fmt(propertyCF)}/month**\n`

    if ((p.plannedInvestments || []).length > 0) {
      portfolioBlock += `\n**Planned Investments**\n`
      for (const inv of p.plannedInvestments) {
        portfolioBlock += `- ${inv.description || 'Unnamed'}: cost ${fmt(inv.cost || 0)}, value increase ${fmt(inv.valueIncrease || 0)}, planned ${inv.plannedDate}\n`
      }
    }

    portfolioBlock += '\n'
  }

  // ── Household profile ──
  const members = profile.members || []
  const totalMemberIncome = members.reduce((s, m) => s + (m.netIncome || 0) + (m.investmentIncome || 0), 0)
  const totalMemberCash   = members.reduce((s, m) => s + (m.cash || 0), 0)

  let monthlyRentalGross   = 0
  let monthlyPropertyLoans = 0
  let monthlyPropertyOpex  = 0
  for (const p of properties) {
    if (p.isRented !== false) monthlyRentalGross += p.startRentalIncome || p.monthlyRentalIncome || 0
    for (const l of p.loans || []) monthlyPropertyLoans += l.monthlyPayment || 0
    monthlyPropertyOpex +=
      ((p.annualMaintenanceCost || 0) + (p.annualInsuranceCost || 0) + (p.annualPropertyTax || 0)) / 12 +
      (p.monthlyExpenses || 0)
  }

  const totalInflow = totalMemberIncome + monthlyRentalGross
  const totalOutflow =
    monthlyPropertyLoans + monthlyPropertyOpex +
    (profile.householdExpenses || 0) +
    totalInflow * (profile.personalSavingsRate || 0)
  const availableCash = totalInflow - totalOutflow

  let profileBlock = `## Household Financial Profile\n`
  profileBlock += `- Number of members: ${members.length}\n`
  for (const m of members) {
    profileBlock += `  - **${m.name || 'Unnamed'}**:\n`
    profileBlock += `    - Monthly net salary: ${fmt(m.netIncome || 0)}\n`
    profileBlock += `    - Monthly investment income: ${fmt(m.investmentIncome || 0)}\n`
    profileBlock += `    - Total monthly income: ${fmt((m.netIncome || 0) + (m.investmentIncome || 0))}\n`
    profileBlock += `    - Cash on hand: ${fmt(m.cash || 0)}\n`
  }
  profileBlock += `- Combined monthly income (all members): ${fmt(totalMemberIncome)}\n`
  profileBlock += `- Total household liquid cash: ${fmt(totalMemberCash)}\n`
  profileBlock += `- Monthly household living expenses: ${fmt(profile.householdExpenses || 0)}\n`
  profileBlock += `- Personal savings rate: ${((profile.personalSavingsRate || 0) * 100).toFixed(0)}% of total income\n\n`

  profileBlock += `### Full Monthly Cash Flow (household + portfolio combined)\n`
  profileBlock += `**Inflows:**\n`
  profileBlock += `- Gross rental income: ${fmt(monthlyRentalGross)}\n`
  profileBlock += `- Member salaries + investment income: ${fmt(totalMemberIncome)}\n`
  profileBlock += `- Total monthly inflow: ${fmt(totalInflow)}\n\n`
  profileBlock += `**Outflows:**\n`
  profileBlock += `- Property operating costs: ${fmt(monthlyPropertyOpex)}\n`
  profileBlock += `- Property loan payments: ${fmt(monthlyPropertyLoans)}\n`
  profileBlock += `- Household living expenses: ${fmt(profile.householdExpenses || 0)}\n`
  profileBlock += `- Savings set aside (${((profile.personalSavingsRate || 0) * 100).toFixed(0)}%): ${fmt(totalInflow * (profile.personalSavingsRate || 0))}\n`
  profileBlock += `- Total monthly outflow: ${fmt(totalOutflow)}\n\n`
  profileBlock += `**Result: Available for new investments: ${fmt(availableCash)}/month (${fmt(availableCash * 12)}/year)**\n\n`



  const systemPrompt = `You are a sharp, data-driven real estate financial advisor specialised in Belgian (Flemish) real estate law and taxation.
You have been given the user's COMPLETE financial picture including every property, every loan (balance, rate, monthly payment, term), all operating costs, all household income, and all expenses.
Do NOT ask for information that has already been provided — it is all in the context.
Be concise, specific, and use the exact numbers from the data provided.
Avoid generic advice — ground every recommendation in the provided figures.
Only ask for missing information if it is genuinely absent from the context.
Format responses with clear headings and bullet points.
Always state any assumptions you make.

## Key Belgian/Flemish tax rules you must apply correctly:

**Rental income tax (huurinkomsten — particuliere verhuur):**
- When renting to a private person for residential use (not professional), the landlord is NOT taxed on actual rent received.
- Instead, Belgian income tax is due on: indexed KI × 1.4 (added to personal income, taxed at progressive rates 25–50%).
- Loan interest is NOT deductible for private residential lettings.
- This tax is NOT modelled in the app's cash flow figures — always flag this when discussing profitability.

**Registration tax (verkooprecht) — Flanders, since 01.01.2022:**
- Investment / rental / second property (niet enige eigen woning): always 12%.
- Sole primary home (enige eigen woning): 2% since 01.01.2025 (was 3% in 2022–2024, 6% in 2020–2021).
- "Klein beschrijf" no longer exists as a rate. A bescheiden woning (≤€220k outside core cities) buying their only home gets a fixed €1,867 reduction off the tax bill (not a different %).
- The BUYER pays registration tax, not the seller. Sellers pay NO registration tax on a normal sale.

**Prepayment penalty (wederbeleggingsvergoeding):**
- Belgian law caps this at 3 months' interest on the repaid amount.
- As % of remaining balance, this is approximately 0.75–1.5% depending on interest rate and remaining term.

**Onroerende voorheffing (property tax):**
- Based on indexed KI × rate (Flemish base: 3.97% + provincial + municipal opcentiemen).
- The KI is indexed annually by the government — the OV bill therefore rises with inflation every year.`

  const contextPrompt = `Here is the user's complete financial picture:\n\n${portfolioBlock}${profileBlock}`

  return { systemPrompt, contextPrompt }
}

// ─── Per-screen focused context ───────────────────────────────────────────────

const TAB_LABELS = {
  dashboard:   'Dashboard (portfolio overview)',
  properties:  'Properties (property list / edit form)',
  investments: 'Planned Investments',
  projection:  '20-Year Projection chart',
  scenario:    'Scenario Planner (hold vs. sell)',
  household:   'Household Profile editor',
  cashflow:    'Cash Flow Aggregator',
  moneyflow:   'Money Flow breakdown',
  simulator:   'Property Simulator (what-if new acquisition)',
}

/**
 * Returns a short, focused context string that describes what the user is
 * currently looking at. Injected as the LAST turn before each user question
 * so it has the highest recency weight for the model.
 */
function buildScreenContext(activeTab, simState, properties, profile) {
  const fmt = formatEUR
  const screenLabel = TAB_LABELS[activeTab] || activeTab || 'unknown'
  let block = `## Current Screen: ${screenLabel}\n`

  switch (activeTab) {
    case 'dashboard': {
      const totalValue = properties.reduce((s, p) => s + (p.currentValue || 0), 0)
      const totalDebt  = properties.reduce((s, p) =>
        s + (p.loans || []).reduce((ls, l) => ls + (l.originalAmount || 0), 0), 0)
      block += `The user is looking at the portfolio overview dashboard.\n`
      block += `- ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} in portfolio\n`
      block += `- Total current value: ${fmt(totalValue)}\n`
      block += `- Approximate total debt: ${fmt(totalDebt)}\n`
      block += `- Net equity (approx): ${fmt(totalValue - totalDebt)}\n`
      break
    }

    case 'properties':
      block += `The user is managing their property list or editing a property form.\n`
      block += `They have ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} recorded.\n`
      if (properties.length > 0) {
        block += `Properties: ${properties.map((p) => `"${p.name}" (${fmt(p.currentValue)})`).join(', ')}\n`
      }
      break

    case 'investments': {
      const allInv = properties.flatMap((p) => (p.plannedInvestments || []).map((i) => ({ ...i, propertyName: p.name })))
      block += `The user is viewing planned capital investments across their portfolio.\n`
      block += `- ${allInv.length} planned investment${allInv.length === 1 ? '' : 's'} total\n`
      if (allInv.length > 0) {
        const totalCost = allInv.reduce((s, i) => s + (i.cost || 0), 0)
        block += `- Total planned spend: ${fmt(totalCost)}\n`
        for (const inv of allInv.slice(0, 5)) {
          block += `  - "${inv.description}" on ${inv.propertyName}: cost ${fmt(inv.cost)}, value increase ${fmt(inv.valueIncrease)}, date ${inv.plannedDate}\n`
        }
        if (allInv.length > 5) block += `  - … and ${allInv.length - 5} more\n`
      }
      break
    }

    case 'projection':
      block += `The user is viewing the 20-year portfolio projection chart.\n`
      block += `This shows net worth, cumulative cash flow, and total return trajectories for all ${properties.length} current properties combined.\n`
      break

    case 'scenario':
      block += `The user is on the Scenario Planner screen, comparing "hold all properties" vs. "sell one or more" scenarios over time.\n`
      break

    case 'household': {
      const members = profile?.members || []
      const totalIncome = members.reduce((s, m) => s + (m.netIncome || 0) + (m.investmentIncome || 0), 0)
      block += `The user is editing their household profile.\n`
      block += `- ${members.length} household member${members.length === 1 ? '' : 's'}\n`
      block += `- Combined monthly income: ${fmt(totalIncome)}\n`
      block += `- Monthly household expenses: ${fmt(profile?.householdExpenses || 0)}\n`
      break
    }

    case 'cashflow': {
      const members = profile?.members || []
      const totalIncome = members.reduce((s, m) => s + (m.netIncome || 0) + (m.investmentIncome || 0), 0)
      const totalRent = properties.filter((p) => p.isRented !== false)
        .reduce((s, p) => s + (p.startRentalIncome || p.monthlyRentalIncome || 0), 0)
      block += `The user is reviewing the household + portfolio combined cash flow aggregator.\n`
      block += `- Total monthly salary + investment income: ${fmt(totalIncome)}\n`
      block += `- Total monthly gross rental income: ${fmt(totalRent)}\n`
      block += `- Monthly household expenses: ${fmt(profile?.householdExpenses || 0)}\n`
      break
    }

    case 'moneyflow':
      block += `The user is on the Money Flow breakdown screen, showing per-property and household-level income/expense flows.\n`
      break

    case 'simulator': {
      if (simState) {
        const price = simState.purchasePrice || 0
        const loan  = simState.loanAmount || 0
        const rent  = simState.monthlyRentalIncome || 0
        const regTax = simState.registrationTax || 0
        block += `The user is actively using the Property Simulator with the following hypothetical scenario:\n`
        block += `- Purchase price: ${fmt(price)}\n`
        block += `- Loan amount: ${fmt(loan)} at ${((simState.loanInterestRate || 0) * 100).toFixed(2)}% — monthly payment ${fmt(simState.loanMonthlyPayment || 0)} over ${simState.loanTermMonths || 0} months\n`
        block += `- Monthly gross rent: ${fmt(rent)} (gross yield: ${price > 0 ? ((rent * 12 / price) * 100).toFixed(2) : 0}%)\n`
        block += `- Renovation / fit-out cost: ${fmt(simState.renovationCost || 0)}\n`
        block += `- Annual appreciation: ${((simState.appreciationRate || 0) * 100).toFixed(1)}%\n`
        block += `- Annual operating costs: ${fmt((simState.annualMaintenanceCost || 0) + (simState.annualInsuranceCost || 0) + (simState.annualPropertyTax || 0) + (simState.monthlyExpenses || 0) * 12)}\n`
        block += `- Acquisition in: ${simState.acquisitionYear || 0} year(s) from today\n`
        if (simState.coBuying) {
          block += `- Buying together with co-buyer: YES\n`
          block += `  - My ownership share: ${((simState.mySharePct || 0.5) * 100).toFixed(0)}%\n`
          block += `  - My registration tax rate: ${((simState.myTaxRate || 0.12) * 100).toFixed(1)}% (already owns another property)\n`
          block += `  - Co-buyer registration tax rate: ${((simState.partnerTaxRate || 0.02) * 100).toFixed(1)}% (enige eigen woning rate — sole primary home, must domicile within 3 years)\n`
          block += `  - My registration tax share: ${fmt(price * (simState.mySharePct || 0.5) * (simState.myTaxRate || 0.12))}\n`
          block += `  - Co-buyer registration tax share: ${fmt(price * (1 - (simState.mySharePct || 0.5)) * (simState.partnerTaxRate || 0.02))}\n`
        } else {
          block += `- Buying alone — registration tax rate: ${((simState.soloTaxRate || 0.12) * 100).toFixed(1)}%\n`
        }
        block += `- Total registration tax (upfront): ${fmt(regTax)}\n`
      } else {
        block += `The user is on the Property Simulator screen (simulator state not yet loaded).\n`
      }
      break
    }

    default:
      block += `Screen: ${activeTab}\n`
  }

  return block
}

// ─── Model selector ───────────────────────────────────────────────────────────

function ModelSelector({ apiKey, selectedModel, onSelect }) {
  const [models, setModels]               = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError]       = useState(null)
  const [open, setOpen]                   = useState(false)
  const [dropdownPos, setDropdownPos]     = useState({ top: 0, left: 0, width: 256 })
  const btnRef                            = useRef(null)
  const dropdownRef                       = useRef(null)

  const fetchModels = useCallback(async () => {
    if (!apiKey) return
    setLoadingModels(true)
    setModelError(null)
    try {
      const res  = await fetch(LIST_MODELS_URL)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      const filtered = (data.models || [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          m.name.toLowerCase().includes('flash')
        )
        .map((m) => ({
          id:          m.name.replace('models/', ''),
          displayName: m.displayName || m.name.replace('models/', ''),
        }))
        .sort((a, b) => b.id.localeCompare(a.id))
      setModels(filtered)
      if (!selectedModel && filtered.length > 0) onSelect(filtered[0].id)
    } catch (err) {
      setModelError(err.message)
    } finally {
      setLoadingModels(false)
    }
  }, [apiKey, selectedModel, onSelect])

  useEffect(() => { if (apiKey) fetchModels() }, [apiKey, fetchModels])

  // Close on outside click or scroll (but not when scrolling inside the dropdown itself)
  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) return
      setOpen(false)
    }
    const handleScroll = (e) => {
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      // Position the dropdown above the button, aligned to its right edge
      setDropdownPos({
        bottom: window.innerHeight - rect.top + 6,
        right:  window.innerWidth - rect.right,
      })
    }
    setOpen((o) => !o)
  }

  if (!apiKey) return null

  const dropdown = open && createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', bottom: dropdownPos.bottom, right: dropdownPos.right, zIndex: 9999 }}
      className="w-64 bg-neo-surface border border-white/60 rounded-2xl shadow-neo-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-neo-border">
        <span className="text-xs text-neo-muted font-medium">Available models</span>
        <button onClick={fetchModels} disabled={loadingModels}
          className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50">
          {loadingModels ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {modelError && <p className="text-xs text-red-400 px-3 py-2">{modelError}</p>}
      <ul className="max-h-60 overflow-y-auto py-1">
        {models.length === 0 && !loadingModels && !modelError && (
          <li className="text-xs text-neo-subtle px-3 py-3 text-center">No models found</li>
        )}
        {models.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => { onSelect(m.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 transition-colors text-xs
                ${selectedModel === m.id
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-neo-text/95 hover:bg-neo-sunken'
                }`}
            >
              <p className="font-medium">{m.displayName}</p>
              <p className="text-neo-subtle font-mono truncate">{m.id}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  )

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        title="Change Gemini model"
        className="flex items-center gap-1.5 text-xs text-neo-muted hover:text-neo-text/95
                   bg-neo-sunken/65 hover:bg-neo-sunken border border-neo-border/50 rounded-lg
                   px-2 py-1 transition-colors max-w-[160px]"
      >
        <svg className="w-3 h-3 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="truncate">{selectedModel || 'Select model…'}</span>
        {loadingModels
          ? <svg className="w-2.5 h-2.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          : <svg className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        }
      </button>
      {dropdown}
    </>
  )
}

// ─── Single message bubble ────────────────────────────────────────────────────

// Markdown component map — scoped styles for the dark chat bubble
const MD_COMPONENTS = {
  h1: ({ children }) => (
    <p className="text-sm font-bold text-neo-text mt-3 mb-1 first:mt-0">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="text-xs font-bold text-neo-text mt-3 mb-1 first:mt-0 uppercase tracking-wide">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="text-xs font-semibold text-brand-600 mt-2.5 mb-0.5 first:mt-0">{children}</p>
  ),
  p: ({ children }) => (
    <p className="text-xs leading-relaxed text-neo-text/95 mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-neo-text">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-neo-muted">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 space-y-0.5 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 space-y-0.5 pl-3 list-decimal">{children}</ol>
  ),
  li: ({ children, ordered }) => ordered ? (
    <li className="text-xs text-neo-text/95 leading-relaxed pl-0.5">{children}</li>
  ) : (
    <li className="text-xs text-neo-text/95 leading-relaxed flex gap-1.5 items-start">
      <span className="text-brand-400 mt-[3px] shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="font-mono text-[11px] bg-neo-surface text-emerald-300 px-1 py-0.5 rounded">{children}</code>
    ) : (
      <pre className="font-mono text-[11px] bg-neo-surface text-emerald-300 rounded-lg px-3 py-2 my-2 overflow-x-auto whitespace-pre-wrap">
        {children}
      </pre>
    ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand-500 pl-3 my-2 text-neo-muted italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-neo-border my-3" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer"
       className="text-brand-400 hover:text-brand-300 underline underline-offset-2">{children}</a>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="text-xs w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-2 py-1 border border-neo-border bg-neo-raised text-neo-muted font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border border-neo-border text-neo-text/95">{children}</td>
  ),
}

function Message({ role, content, loading }) {
  return (
    <div className={`flex gap-2 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {role === 'assistant' && (
        <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5 text-neo-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2.5
          ${role === 'user'
            ? 'bg-brand-600 text-white rounded-tr-sm text-xs leading-relaxed shadow-neo-sm'
            : 'bg-neo-raised text-neo-text/95 rounded-tl-sm border border-neo-border'
          }`}
      >
        {loading ? (
          <span className="flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 bg-neo-subtle rounded-full animate-bounce shadow-neo-inset-sm" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-neo-subtle rounded-full animate-bounce shadow-neo-inset-sm" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-neo-subtle rounded-full animate-bounce shadow-neo-inset-sm" style={{ animationDelay: '300ms' }} />
          </span>
        ) : role === 'assistant' ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
            {content}
          </ReactMarkdown>
        ) : (
          content
        )}
      </div>
      {role === 'user' && (
        <div className="w-6 h-6 rounded-full bg-neo-sunken flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5 text-neo-muted" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Session list panel ───────────────────────────────────────────────────────

function SessionPanel({ sessions, activeId, onSelect, onNew, onDelete, onClose }) {
  return (
    <div className="flex flex-col h-full bg-neo-surface">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neo-border">
        <span className="text-sm font-semibold text-neo-text">Chat history</span>
        <button onClick={onClose} className="text-neo-muted hover:text-neo-text/95 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 border-b border-neo-border">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500
                     text-neo-text text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New session
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {sessions.length === 0 && (
          <li className="text-xs text-neo-subtle px-2 py-4 text-center">No sessions yet</li>
        )}
        {[...sessions].reverse().map((s) => (
          <li key={s.id}>
            <div className={`group flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors
                             ${s.id === activeId ? 'bg-brand-600/20' : 'hover:bg-neo-raised'}`}
                 onClick={() => onSelect(s.id)}>
              <svg className="w-3.5 h-3.5 text-neo-subtle shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${s.id === activeId ? 'text-brand-300' : 'text-neo-text/95'}`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-neo-subtle">
                  {s.messages.length} message{s.messages.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                className="opacity-0 group-hover:opacity-100 text-neo-subtle hover:text-red-400
                           transition-all shrink-0"
                title="Delete session"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main overlay component ───────────────────────────────────────────────────

export default function AiChatOverlay({ properties, profile, activeTab, simState, isOwner }) {
  const [open, setOpen]                   = useState(false)
  const [showSessions, setShowSessions]   = useState(false)
  const [sessions, setSessions]           = useState(() => loadSessions())
  const [activeId, setActiveId]           = useState(() => {
    const saved = loadActiveId()
    const all   = loadSessions()
    if (saved && all.find((s) => s.id === saved)) return saved
    if (all.length > 0) return all[all.length - 1].id
    return null
  })
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [selectedModel, setSelectedModel] = useState(() => loadModel())
  const bottomRef                         = useRef(null)
  const inputRef                          = useRef(null)

  // AI chat is only available to the authenticated owner — the Gemini API key
  // should not be usable by anonymous guests.
  const hasKey = Boolean(GEMINI_API_KEY) && Boolean(isOwner)

  // Derive the active session object
  const activeSession = sessions.find((s) => s.id === activeId) || null
  const messages      = activeSession?.messages || []

  // Persist sessions, active session, and selected model whenever they change
  useEffect(() => { saveSessions(sessions) },       [sessions])
  useEffect(() => { saveActiveId(activeId) },       [activeId])
  useEffect(() => { saveModel(selectedModel) },     [selectedModel])

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  // Ensure there's always at least one session
  const ensureSession = useCallback(() => {
    if (sessions.length === 0) {
      const s = newSession()
      setSessions([s])
      setActiveId(s.id)
      return s.id
    }
    if (!activeId || !sessions.find((s) => s.id === activeId)) {
      const id = sessions[sessions.length - 1].id
      setActiveId(id)
      return id
    }
    return activeId
  }, [sessions, activeId])

  const handleNewSession = () => {
    const s = newSession()
    setSessions((prev) => [...prev, s])
    setActiveId(s.id)
    setShowSessions(false)
    setError(null)
  }

  const handleSelectSession = (id) => {
    setActiveId(id)
    setShowSessions(false)
    setError(null)
  }

  const handleDeleteSession = (id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (activeId === id) {
        const newActive = next.length > 0 ? next[next.length - 1].id : null
        setActiveId(newActive)
      }
      return next
    })
  }

  const updateActiveMessages = (updater) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages: updater(s.messages) } : s
      )
    )
  }

  const sendMessage = async (text) => {
    if (!text.trim() || loading || !selectedModel) return
    setError(null)

    // Make sure a session exists
    const sessionId = ensureSession()

    const userMsg = { role: 'user', content: text.trim() }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s
      )
    )
    setInput('')
    setLoading(true)

    try {
      const { systemPrompt, contextPrompt } = buildFinancialContext(properties, profile)
      const screenContext = buildScreenContext(activeTab, simState, properties, profile)

      // Build contents from the current session's messages
      const currentMessages = sessions.find((s) => s.id === sessionId)?.messages || []

      const contents = [
        // Full portfolio + household context — always the first grounding turn
        {
          role: 'user',
          parts: [{ text: `${contextPrompt}\n\n---\nI will now ask you questions about my financial situation. Please answer based only on the data I have provided above.` }],
        },
        {
          role: 'model',
          parts: [{ text: "Understood. I have reviewed your complete financial picture and I'm ready to answer your questions with specific, data-driven advice." }],
        },
        // Prior conversation turns
        ...currentMessages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
        // Focused screen context injected just before the question for high recency
        {
          role: 'user',
          parts: [{ text: `Before I ask my question, here is what I am currently looking at in the app:\n\n${screenContext}\nPlease keep this screen context in mind when answering.` }],
        },
        {
          role: 'model',
          parts: [{ text: `Noted — you are currently on the ${TAB_LABELS[activeTab] || activeTab || 'app'} screen. I'll focus my answer on that context while keeping your full financial picture in mind.` }],
        },
        { role: 'user', parts: [{ text: text.trim() }] },
      ]

      const response = await fetch(endpointFor(selectedModel), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody?.error?.message || `Gemini API error ${response.status}: ${response.statusText}`)
      }

      const data        = await response.json()
      const candidate   = data?.candidates?.[0]
      const reply       = candidate?.content?.parts?.[0]?.text
      const finishReason = candidate?.finishReason  // 'STOP' | 'MAX_TOKENS' | 'SAFETY' | …

      if (!reply) throw new Error('Empty response from Gemini.')

      // Warn the user if the response was cut short by the token limit
      const truncated = finishReason === 'MAX_TOKENS'
      const fullContent = truncated
        ? reply + '\n\n*— response was cut off (token limit reached) —*'
        : reply

      // userMsg was already optimistically appended — just add the assistant reply
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, { role: 'assistant', content: fullContent, truncated }] }
            : s
        )
      )
    } catch (err) {
      setError(err.message)
      // Remove the optimistically added user message
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: s.messages.slice(0, -1) }
            : s
        )
      )
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const canSend = hasKey && !loading && !!input.trim() && !!selectedModel

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating action button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="AI Chat"
        className={`fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full shadow-neo-lg
                    flex items-center justify-center transition-all duration-200
                    ${open
                      ? 'bg-neo-sunken hover:bg-neo-sunken rotate-45'
                      : 'bg-brand-600 hover:bg-brand-500 hover:scale-105'
                    }`}
      >
        {open ? (
          /* Close (×) icon when panel is open */
          <svg className="w-6 h-6 text-neo-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ) : (
          /* AI icon when panel is closed */
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[99] w-[380px] max-w-[calc(100vw-2rem)]
                     h-[560px] max-h-[calc(100vh-8rem)]
                     bg-neo-surface border border-white/60 rounded-3xl shadow-neo-lg
                     flex flex-col overflow-hidden"
        >
          {showSessions ? (
            /* ── Session list view ── */
            <SessionPanel
              sessions={sessions}
              activeId={activeId}
              onSelect={handleSelectSession}
              onNew={handleNewSession}
              onDelete={handleDeleteSession}
              onClose={() => setShowSessions(false)}
            />
          ) : (
            /* ── Chat view ── */
            <>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neo-border shrink-0">
                {/* Session switcher */}
                <button
                  onClick={() => setShowSessions(true)}
                  title="Browse sessions"
                  className="p-1.5 rounded-lg text-neo-muted hover:text-neo-text/95 hover:bg-neo-raised transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neo-text truncate">
                    {activeSession?.label || 'AI Advisor'}
                  </p>
                  <p className="text-[10px] text-neo-subtle">Powered by Google Gemini</p>
                </div>

                {/* New session */}
                <button
                  onClick={handleNewSession}
                  title="New session"
                  className="p-1.5 rounded-lg text-neo-muted hover:text-neo-text/95 hover:bg-neo-raised transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>

              {/* Guest mode — AI disabled */}
              {!isOwner && (
                <div className="m-3 rounded-xl border border-neo-border/60 bg-neo-sunken/70 p-3 space-y-1.5 shrink-0">
                  <p className="text-neo-muted text-xs font-semibold">AI chat — owner only</p>
                  <p className="text-neo-muted text-xs leading-relaxed">
                    You are browsing as a guest. Log in as owner using the{' '}
                    <span className="text-brand-300 font-medium">lock icon</span> in the sidebar
                    to enable the AI advisor.
                  </p>
                </div>
              )}

              {/* No API key warning (owner is authed but key missing in env) */}
              {isOwner && !hasKey && (
                <div className="m-3 rounded-2xl border border-amber-200/80 bg-amber-50 shadow-neo-inset-sm p-3 space-y-2 shrink-0">
                  <p className="text-amber-900 text-xs font-semibold">API key not configured</p>
                  <p className="text-amber-800/90 text-xs">
                    Add <span className="font-mono">VITE_GEMINI_API_KEY</span> to your{' '}
                    <span className="font-mono">.env</span> and restart the dev server.
                  </p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center h-full py-4 space-y-4">
                    <div className="w-10 h-10 rounded-2xl bg-brand-600/20 border border-brand-500/30
                                    flex items-center justify-center">
                      <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-neo-muted text-xs font-medium">Ask anything about your finances</p>
                      <p className="text-neo-subtle text-xs mt-1">
                        AI has full context of your portfolio & household.
                      </p>
                      {hasKey && !selectedModel && (
                        <p className="text-amber-400 text-xs mt-1">Loading models…</p>
                      )}
                    </div>
                    {hasKey && selectedModel && (
                      <div className="w-full space-y-1.5">
                        {SUGGESTIONS.slice(0, 3).map((s) => (
                          <button
                            key={s}
                            onClick={() => sendMessage(s)}
                            className="w-full text-left text-xs text-neo-muted bg-neo-raised hover:bg-neo-sunken
                                       border border-neo-border hover:shadow-neo rounded-xl px-3 py-2
                                       transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {messages.map((m, i) => (
                  <Message key={i} role={m.role} content={m.content} />
                ))}

                {loading && <Message role="assistant" loading />}

                {error && (
                  <div className="rounded-xl border border-red-200/80 bg-red-50 shadow-neo-inset-sm px-3 py-2">
                    <p className="text-red-800 text-xs">
                      <span className="font-semibold">Error: </span>{error}
                    </p>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Quick suggestions (after first message) */}
              {messages.length > 0 && hasKey && selectedModel && (
                <div className="border-t border-neo-border px-3 py-1.5 flex gap-1.5 overflow-x-auto shrink-0">
                  {SUGGESTIONS.slice(3).map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      disabled={loading}
                      className="shrink-0 text-[10px] text-neo-muted hover:text-neo-text/95 bg-neo-raised
                                 hover:bg-neo-sunken border border-neo-border rounded-lg px-2 py-1
                                 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="border-t border-neo-border p-2 shrink-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ModelSelector
                    apiKey={GEMINI_API_KEY}
                    selectedModel={selectedModel}
                    onSelect={setSelectedModel}
                  />
                </div>
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      !hasKey
                        ? 'Configure API key…'
                        : !selectedModel
                        ? 'Loading models…'
                        : 'Ask about your portfolio…'
                    }
                    disabled={!hasKey || loading || !selectedModel}
                    className="input flex-1 text-xs py-2"
                  />
                  <button
                    type="submit"
                    disabled={!canSend}
                    className="btn-primary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
