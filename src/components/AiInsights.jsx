/**
 * AiInsights.jsx — Phase 8
 *
 * Uses the Google Gemini API with a dynamic model selector.
 * Available models are fetched live from the ListModels endpoint so the
 * list is always up-to-date regardless of which models Google adds or
 * deprecates.
 *
 * Requires VITE_GEMINI_API_KEY in your .env file.
 *
 * Props:
 *   properties  – current portfolio array
 *   profile     – household profile object
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { computeSummary, formatEUR } from '../utils/projectionUtils'

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const LIST_MODELS_URL =
  `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Can I afford to buy a new rental property in 2 years?',
  'What is the fastest way to save for a down payment?',
  'How much will my portfolio be worth in 10 years if I buy one more property?',
  'Am I generating positive cash flow right now? What is holding me back?',
  'What rental yield should I target on my next property?',
  'How does my partner\'s cash contribution speed up my acquisition timeline?',
  'What happens to my cash flow when I start paying the new residence mortgage?',
  'Suggest a realistic 5-year property acquisition roadmap for my situation.',
]

// ─── Context builder ──────────────────────────────────────────────────────────

function buildFinancialContext(properties, profile) {
  const summary = computeSummary(properties)
  const fmt = formatEUR

  let portfolioBlock = `## Current Portfolio (${properties.length} propert${properties.length === 1 ? 'y' : 'ies'})\n`
  portfolioBlock += `- Total portfolio value: ${fmt(summary.totalPortfolioValue)}\n`
  portfolioBlock += `- Total debt (outstanding loans): ${fmt(summary.totalDebt)}\n`
  portfolioBlock += `- Net worth (equity): ${fmt(summary.totalNetWorth)}\n`
  portfolioBlock += `- Monthly net cash flow from portfolio: ${fmt(summary.totalMonthlyCashFlow)}\n`
  portfolioBlock += `- Annual net cash flow: ${fmt(summary.annualNetCashFlow)}\n`
  portfolioBlock += `- Return on equity: ${summary.roe.toFixed(2)}%\n\n`
  portfolioBlock += `### Properties\n`
  for (const p of properties) {
    portfolioBlock += `- **${p.name}**: value ${fmt(p.currentValue)}, `
    portfolioBlock += p.isRented !== false
      ? `rented at ${fmt(p.startRentalIncome || 0)} /month, `
      : `NOT rented (primary residence or vacant), `
    portfolioBlock += `appreciation ${((p.appreciationRate || 0.02) * 100).toFixed(1)}%/yr, `
    portfolioBlock += `${p.loans?.length || 0} loan(s)\n`
  }

  const totalMonthlyIncome =
    (profile.myNetIncome || 0) +
    (profile.myInvestmentIncome || 0) +
    (profile.partnerNetIncome || 0)
  let monthlyRentalGross = 0
  for (const p of properties) {
    if (p.isRented !== false) monthlyRentalGross += p.startRentalIncome || 0
  }
  let monthlyPropertyLoans = 0
  for (const p of properties) {
    for (const l of p.loans || []) monthlyPropertyLoans += l.monthlyPayment || 0
  }
  let monthlyPropertyOpex = 0
  for (const p of properties) {
    monthlyPropertyOpex +=
      ((p.annualMaintenanceCost || 0) + (p.annualInsuranceCost || 0) + (p.annualPropertyTax || 0)) / 12 +
      (p.monthlyExpenses || 0)
  }
  const totalInflow = totalMonthlyIncome + monthlyRentalGross
  const totalOutflow =
    monthlyPropertyLoans + monthlyPropertyOpex +
    (profile.householdExpenses || 0) +
    (profile.newResidenceMonthlyPayment || 0) +
    totalInflow * (profile.personalSavingsRate || 0)
  const availableCash = totalInflow - totalOutflow

  let profileBlock = `\n## Household Financial Profile\n`
  profileBlock += `- Your net salary: ${fmt(profile.myNetIncome || 0)} /month\n`
  profileBlock += `- Your investment/trading income: ${fmt(profile.myInvestmentIncome || 0)} /month\n`
  profileBlock += `- Partner net salary: ${fmt(profile.partnerNetIncome || 0)} /month\n`
  profileBlock += `- Partner lump-sum cash available: ${fmt(profile.partnerCash || 0)}\n`
  profileBlock += `- Joint household living expenses: ${fmt(profile.householdExpenses || 0)} /month\n`
  profileBlock += `- Personal savings rate: ${((profile.personalSavingsRate || 0) * 100).toFixed(0)}%\n\n`
  profileBlock += `### Derived Cash Flow\n`
  profileBlock += `- Total monthly inflow (all sources): ${fmt(totalInflow)}\n`
  profileBlock += `- Total monthly outflow (all obligations + savings): ${fmt(totalOutflow)}\n`
  profileBlock += `- **Available for new investments: ${fmt(availableCash)} /month (${fmt(availableCash * 12)} /year)**\n\n`

  if (profile.targetDownPayment > 0) {
    profileBlock += `### Acquisition Target\n`
    profileBlock += `- Target down payment: ${fmt(profile.targetDownPayment)}\n`
    if (profile.targetPurchaseYear) profileBlock += `- Target purchase year: ${profile.targetPurchaseYear}\n`
    const remaining = Math.max(0, (profile.targetDownPayment || 0) - (profile.partnerCash || 0))
    profileBlock += `- Down payment still needed (after partner cash): ${fmt(remaining)}\n`
    if (availableCash > 0 && remaining > 0) {
      const months = Math.ceil(remaining / availableCash)
      profileBlock += `- Estimated months to reach goal at current savings: ~${months} months\n`
    }
    profileBlock += `\n`
  }

  if (profile.newResidencePrice > 0) {
    profileBlock += `### New Primary Residence (Joint with Partner)\n`
    profileBlock += `- Purchase price: ${fmt(profile.newResidencePrice)}\n`
    profileBlock += `- Joint loan: ${fmt(profile.newResidenceLoanAmount)}\n`
    profileBlock += `- Down payment needed: ${fmt(profile.newResidencePrice - profile.newResidenceLoanAmount)}\n`
    profileBlock += `- Monthly joint mortgage: ${fmt(profile.newResidenceMonthlyPayment)}\n`
  }

  const systemPrompt = `You are a sharp, data-driven real estate financial advisor. 
You have full access to the user's real estate portfolio and household financial situation.
Be concise, specific, and honest. Use exact numbers from the data. 
Avoid generic advice — ground every recommendation in the provided figures.
When the data is insufficient, say so clearly and specify exactly what information is missing.
Format your responses with clear headings and bullet points where helpful.
Always state assumptions you make.`

  const contextPrompt = `Here is the user's complete financial picture:\n\n${portfolioBlock}${profileBlock}`

  return { systemPrompt, contextPrompt }
}

// ─── Model selector ───────────────────────────────────────────────────────────

function ModelSelector({ apiKey, selectedModel, onSelect }) {
  const [models, setModels]   = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState(null)
  const [open, setOpen]       = useState(false)
  const dropdownRef           = useRef(null)

  const fetchModels = useCallback(async () => {
    if (!apiKey) return
    setLoadingModels(true)
    setModelError(null)
    try {
      const res  = await fetch(LIST_MODELS_URL)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      // Keep only free-tier Flash models (flash / flash-lite).
      // The ListModels API has no pricing field — free tier is identified
      // by the "flash" keyword in the model name; pro/ultra are paid.
      const filtered = (data.models || [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          m.name.toLowerCase().includes('flash')
        )
        .map((m) => ({
          id:          m.name.replace('models/', ''),   // e.g. "gemini-2.0-flash"
          displayName: m.displayName || m.name.replace('models/', ''),
          description: m.description || '',
        }))
        // Newest first: reverse-alphabetical on the id works well for semver-ish names
        .sort((a, b) => b.id.localeCompare(a.id))
      setModels(filtered)
      // Auto-select first if none selected yet
      if (!selectedModel && filtered.length > 0) onSelect(filtered[0].id)
    } catch (err) {
      setModelError(err.message)
    } finally {
      setLoadingModels(false)
    }
  }, [apiKey, selectedModel, onSelect])

  // Fetch on mount when key is present
  useEffect(() => {
    if (apiKey) fetchModels()
  }, [apiKey, fetchModels])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!apiKey) return null

  const currentLabel = selectedModel || 'Select model…'

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600
                   text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
                   max-w-[220px]"
        title="Change Gemini model"
      >
        <svg className="w-3.5 h-3.5 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="truncate">{currentLabel}</span>
        {loadingModels ? (
          <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        ) : (
          <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-slate-800 border border-slate-700
                        rounded-xl shadow-2xl overflow-hidden">
          {/* Refresh button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs text-slate-400 font-medium">Available models</span>
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
            >
              {loadingModels ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {modelError && (
            <p className="text-xs text-red-400 px-3 py-2">{modelError}</p>
          )}

          {/* Model list */}
          <ul className="max-h-72 overflow-y-auto py-1">
            {models.length === 0 && !loadingModels && !modelError && (
              <li className="text-xs text-slate-500 px-3 py-3 text-center">No models found</li>
            )}
            {models.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(m.id); setOpen(false) }}
                  className={`w-full text-left px-3 py-2.5 transition-colors
                    ${selectedModel === m.id
                      ? 'bg-brand-600/20 text-brand-300'
                      : 'text-slate-200 hover:bg-slate-700'
                    }`}
                >
                  <p className="text-xs font-medium">{m.displayName}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">{m.id}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Message component ────────────────────────────────────────────────────────

function Message({ role, content, loading }) {
  return (
    <div className={`flex gap-3 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {role === 'assistant' && (
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
          ${role === 'user'
            ? 'bg-brand-600 text-white rounded-tr-sm'
            : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
          }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : content}
      </div>
      {role === 'user' && (
        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AiInsights({ properties, profile }) {
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [selectedModel, setSelectedModel] = useState('')
  const bottomRef                   = useRef(null)
  const inputRef                    = useRef(null)

  const hasKey = Boolean(GEMINI_API_KEY)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    if (!text.trim() || loading || !selectedModel) return
    setError(null)

    const userMsg = { role: 'user', content: text.trim() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { systemPrompt, contextPrompt } = buildFinancialContext(properties, profile)

      const contents = [
        {
          role: 'user',
          parts: [{ text: `${contextPrompt}\n\n---\nI will now ask you questions about my financial situation. Please answer based only on the data I have provided above.` }],
        },
        {
          role: 'model',
          parts: [{ text: "Understood. I have reviewed your complete financial picture and I'm ready to answer your questions with specific, data-driven advice." }],
        },
        ...messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: text.trim() }] },
      ]

      const response = await fetch(endpointFor(selectedModel), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody?.error?.message || `Gemini API error ${response.status}: ${response.statusText}`)
      }

      const data  = await response.json()
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!reply) throw new Error('Empty response from Gemini.')

      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message)
      setMessages((m) => m.slice(0, -1))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  const canSend = hasKey && !loading && !!input.trim() && !!selectedModel

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Insights</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Ask questions about your portfolio and household finances. Powered by Google Gemini.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ModelSelector
            apiKey={GEMINI_API_KEY}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
          />
          {messages.length > 0 && (
            <button onClick={clearChat} className="btn-secondary text-xs">
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* No API key warning */}
      {!hasKey && (
        <div className="card border border-amber-700/40 bg-amber-900/10 space-y-3">
          <p className="text-amber-300 text-sm font-semibold">API key not configured</p>
          <p className="text-amber-200/80 text-sm">
            This feature requires a free Google Gemini API key. To set it up:
          </p>
          <ol className="text-amber-200/70 text-sm space-y-1 list-decimal list-inside">
            <li>Go to <span className="font-mono text-amber-300">aistudio.google.com</span> and create a free API key</li>
            <li>Add it to your <span className="font-mono text-amber-300">.env</span> file:</li>
          </ol>
          <pre className="text-xs bg-slate-900 text-emerald-300 rounded-lg px-4 py-3 font-mono">
            VITE_GEMINI_API_KEY=your_key_here
          </pre>
          <p className="text-amber-200/60 text-xs">
            Restart the dev server after adding the key.
          </p>
        </div>
      )}

      {/* Data context summary */}
      <div className="card bg-slate-800/50">
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Context provided to AI: </span>
          {properties.length} propert{properties.length === 1 ? 'y' : 'ies'},{' '}
          {properties.reduce((s, p) => s + (p.loans?.length || 0), 0)} loan(s),{' '}
          household income {formatEUR((profile.myNetIncome || 0) + (profile.partnerNetIncome || 0))} /month,{' '}
          partner cash {formatEUR(profile.partnerCash || 0)}.
          {!profile.myNetIncome && !profile.partnerNetIncome && (
            <span className="text-amber-400 ml-1">
              Income not set — configure your Household Profile for better answers.
            </span>
          )}
        </p>
      </div>

      {/* Chat window */}
      <div className="card min-h-[400px] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[340px] max-h-[600px]">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full py-8 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-medium">Ask anything about your finances</p>
                <p className="text-slate-500 text-sm mt-1">
                  The AI has full visibility into your portfolio and household profile.
                </p>
                {hasKey && !selectedModel && (
                  <p className="text-amber-400 text-xs mt-2">Loading available models…</p>
                )}
              </div>
              {hasKey && selectedModel && (
                <div className="w-full max-w-lg space-y-2">
                  <p className="text-xs text-slate-500 text-center">Suggested questions</p>
                  <div className="grid grid-cols-1 gap-2">
                    {SUGGESTIONS.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-left text-xs text-slate-300 bg-slate-800 hover:bg-slate-700
                                   border border-slate-700 hover:border-brand-500/50 rounded-xl px-3 py-2
                                   transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} role={m.role} content={m.content} />
          ))}

          {loading && <Message role="assistant" loading />}

          {error && (
            <div className="card border border-red-700/40 bg-red-900/10">
              <p className="text-red-300 text-sm">
                <span className="font-semibold">Error: </span>{error}
              </p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions bar (after first message) */}
        {messages.length > 0 && hasKey && selectedModel && (
          <div className="border-t border-slate-700 px-4 py-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.slice(4).map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={loading}
                className="shrink-0 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700
                           border border-slate-700 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap
                           disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-slate-700 p-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              !hasKey
                ? 'Configure VITE_GEMINI_API_KEY to enable this feature'
                : !selectedModel
                ? 'Loading models…'
                : 'Ask about your portfolio, cash flow, or acquisition strategy…'
            }
            disabled={!hasKey || loading || !selectedModel}
            className="input flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
