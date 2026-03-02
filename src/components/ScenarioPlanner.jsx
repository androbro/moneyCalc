import { useState, useMemo } from 'react'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  buildPropertyScenarioComparison,
  computePropertySaleProceeds,
  formatEUR,
} from '../utils/projectionUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatYAxis(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `€${(value / 1_000).toFixed(0)}k`
  return `€${value}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-xs min-w-[200px]">
      <p className="font-semibold text-white mb-2 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="font-medium flex items-center gap-1.5" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-white font-semibold">{formatEUR(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Investment Type Presets ──────────────────────────────────────────────────

const INVESTMENT_TYPES = {
  etf: { label: 'ETF (Diversified)', rate: 0.07, description: 'IWDA/VWCE historical average' },
  bonds: { label: 'Bonds', rate: 0.035, description: 'Belgian government bonds' },
  savings: { label: 'High-Yield Savings', rate: 0.015, description: 'Risk-free savings account' },
  custom: { label: 'Custom Rate', rate: 0.05, description: 'Enter your own expected return' },
}

// ─── Property Card Component ──────────────────────────────────────────────────

function PropertyCard({ property, decision, onDecisionChange }) {
  const equity = property.currentValue - (property.loans || []).reduce(
    (sum, loan) => sum + (loan.originalAmount || 0), 0
  )
  
  const action = decision.action || 'keep'
  const investmentType = decision.investmentType || 'etf'
  const customRate = decision.investmentRate || INVESTMENT_TYPES[investmentType].rate
  
  return (
    <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:border-slate-500 transition-colors">
      {/* Property header */}
      <div className="mb-3">
        <h3 className="font-semibold text-white text-sm">{property.name || 'Unnamed Property'}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{property.address || 'No address'}</p>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4 pb-3 border-b border-slate-600">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Value</p>
          <p className="text-xs font-semibold text-white">{formatEUR(property.currentValue || 0)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Equity</p>
          <p className="text-xs font-semibold text-emerald-400">{formatEUR(equity)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Rent</p>
          <p className="text-xs font-semibold text-blue-400">
            {property.status === 'rented' 
              ? `€${Math.round((property.startRentalIncome || property.monthlyRentalIncome || 0))}/mo`
              : 'N/A'}
          </p>
        </div>
      </div>
      
      {/* Action selector */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Action</label>
          <select
            className="input text-sm"
            value={action}
            onChange={(e) => onDecisionChange({ ...decision, action: e.target.value })}
          >
            <option value="keep">Keep & Rent</option>
            <option value="sell">Sell & Invest</option>
            <option value="occupy">Owner Occupy</option>
          </select>
        </div>
        
        {/* Investment options (only shown when selling) */}
        {action === 'sell' && (
          <>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Investment Type</label>
              <select
                className="input text-sm"
                value={investmentType}
                onChange={(e) => {
                  const type = e.target.value
                  onDecisionChange({
                    ...decision,
                    investmentType: type,
                    investmentRate: INVESTMENT_TYPES[type].rate
                  })
                }}
              >
                {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {INVESTMENT_TYPES[investmentType].description}
              </p>
            </div>
            
            {investmentType === 'custom' && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Expected Return</label>
                <div className="relative">
                  <input
                    className="input text-sm pr-8"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={(customRate * 100).toFixed(1)}
                    onChange={(e) => onDecisionChange({
                      ...decision,
                      investmentRate: Number(e.target.value) / 100
                    })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
              </div>
            )}
            
            {/* Sale timing */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Sale Timing</label>
              <select
                className="input text-sm"
                value={decision.saleYear || 0}
                onChange={(e) => onDecisionChange({ ...decision, saleYear: Number(e.target.value) })}
              >
                <option value={0}>Immediate (Year 0)</option>
                <option value={1}>Year 1</option>
                <option value={2}>Year 2</option>
                <option value={3}>Year 3</option>
                <option value={5}>Year 5</option>
                <option value={10}>Year 10</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Tax Configuration Panel ──────────────────────────────────────────────────

function TaxConfigPanel({ config, onChange }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-100 mb-4">Tax Configuration</h3>
      <div className="space-y-4">
        
        {/* Rental income tax */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">Rental Income Tax</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="rentalTax"
                checked={config.useWithholding === true}
                onChange={() => onChange({ ...config, useWithholding: true })}
                className="text-brand-500"
              />
              <span className="text-sm text-slate-300">
                30% withholding tax (simplified regime)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="rentalTax"
                checked={config.useWithholding === false}
                onChange={() => onChange({ ...config, useWithholding: false })}
                className="text-brand-500"
              />
              <span className="text-sm text-slate-300">
                Personal income declaration (no withholding applied here)
              </span>
            </label>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Belgian rental income can be taxed via 30% withholding or declared in personal income (marginal rate varies)
          </p>
        </div>
        
        {/* Capital gains tax */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.capitalGainsApplies !== false}
              onChange={(e) => onChange({ ...config, capitalGainsApplies: e.target.checked })}
              className="text-brand-500"
            />
            <span className="text-sm text-slate-300">
              Apply 16.5% capital gains tax (if sold within 5 years of purchase)
            </span>
          </label>
          <p className="text-xs text-slate-500 mt-1 ml-6">
            Belgian speculation tax applies to properties sold within 5 years
          </p>
        </div>
        
        {/* ETF dividend tax */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">ETF Dividend Taxation</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={(config.etfDividendPct || 0) * 100}
              onChange={(e) => onChange({ ...config, etfDividendPct: Number(e.target.value) / 100 })}
              className="flex-1"
            />
            <span className="text-sm font-semibold text-white w-12 text-right">
              {((config.etfDividendPct || 0) * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Percentage of ETF returns from dividends (30% tax applies). Accumulating ETFs: 0%. Distributing ETFs: 20-40%.
          </p>
        </div>
        
      </div>
    </div>
  )
}

// ─── Sale Breakdown Card ──────────────────────────────────────────────────────

function SaleBreakdownCard({ properties, decisions, taxConfig }) {
  const soldProperties = properties.filter(p => decisions[p.id]?.action === 'sell')
  
  if (soldProperties.length === 0) return null
  
  return (
    <div className="card">
      <h3 className="section-title mb-4">Sale Proceeds Breakdown</h3>
      <div className="space-y-4">
        {soldProperties.map(property => {
          const decision = decisions[property.id]
          const saleYear = decision.saleYear || 0
          const proceeds = computePropertySaleProceeds(property, saleYear, taxConfig, {
            brokeragePct: 0.03,
            prepaymentPct: 0.01
          })
          
          return (
            <div key={property.id} className="bg-slate-700/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white text-sm">{property.name}</h4>
                <span className="text-xs text-slate-400">Year {saleYear}</span>
              </div>
              
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Projected sale value</span>
                  <span className="text-emerald-400 font-medium">{formatEUR(proceeds.grossValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining loan</span>
                  <span className="text-red-400 font-medium">-{formatEUR(proceeds.loanBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Brokerage (3%)</span>
                  <span className="text-orange-400 font-medium">-{formatEUR(proceeds.brokerageFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prepayment penalty (1%)</span>
                  <span className="text-orange-400 font-medium">-{formatEUR(proceeds.prepaymentPenalty)}</span>
                </div>
                {proceeds.capitalGainsTax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capital gains tax (16.5%)</span>
                    <span className="text-orange-400 font-medium">-{formatEUR(proceeds.capitalGainsTax)}</span>
                  </div>
                )}
              </div>
              
              <div className="border-t border-slate-600 pt-2 flex justify-between items-center">
                <span className="font-semibold text-slate-200">Net Proceeds</span>
                <span className="text-lg font-bold text-emerald-400">{formatEUR(proceeds.netProceeds)}</span>
              </div>
              
              <div className="text-xs text-slate-500">
                Invested in {INVESTMENT_TYPES[decision.investmentType]?.label} at {((decision.investmentRate || 0.07) * 100).toFixed(1)}% annual return
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({ data }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? data : data.filter(d => d.year === 0 || d.year === 5 || d.year === 10 || d.year === 15 || d.year === 20)
  
  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Year-by-Year Comparison</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          {expanded ? 'Show key years' : 'Show all 20 years'}
        </button>
      </div>
      
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="py-2 text-left pr-3 text-slate-400 font-medium text-xs">Year</th>
            <th className="py-2 text-right px-2 text-slate-400 font-medium text-xs">Keep: Net Worth</th>
            <th className="py-2 text-right px-2 text-slate-400 font-medium text-xs">Keep: Cash Flow</th>
            <th className="py-2 text-right px-2 text-slate-400 font-medium text-xs">Custom: Net Worth</th>
            <th className="py-2 text-right px-2 text-slate-400 font-medium text-xs">Custom: Cash Flow</th>
            <th className="py-2 text-right pl-2 text-slate-400 font-medium text-xs">Better</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => {
            const customBetter = row.customNetWorth > row.baselineNetWorth
            const diff = row.customNetWorth - row.baselineNetWorth
            
            return (
              <tr key={row.year} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-slate-200">{row.label}</td>
                <td className="py-2 px-2 text-right text-emerald-400 font-medium">
                  {formatEUR(row.baselineNetWorth)}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-xs">
                  {formatEUR(row.baselineCF)}
                </td>
                <td className="py-2 px-2 text-right text-violet-400 font-medium">
                  {formatEUR(row.customNetWorth)}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-xs">
                  {formatEUR(row.customCF)}
                </td>
                <td className="py-2 pl-2 text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    Math.abs(diff) < 1000
                      ? 'bg-slate-700 text-slate-300'
                      : customBetter
                        ? 'bg-violet-900/40 text-violet-400'
                        : 'bg-emerald-900/40 text-emerald-400'
                  }`}>
                    {Math.abs(diff) < 1000 ? 'Neutral' : customBetter ? 'Custom' : 'Keep'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ data }) {
  const finalYear = data[data.length - 1]
  const baselineEnd = finalYear.baselineNetWorth
  const customEnd = finalYear.customNetWorth
  const netWorthDiff = customEnd - baselineEnd
  const netWorthDiffPct = baselineEnd > 0 ? (netWorthDiff / baselineEnd) * 100 : 0
  
  const baselineCFTotal = finalYear.baselineCF
  const customCFTotal = finalYear.customCF
  const cfDiff = customCFTotal - baselineCFTotal
  
  const customBetter = netWorthDiff > 0
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Net Worth at Year 20 */}
      <div className="card">
        <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-2">Net Worth (Year 20)</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300">Keep All</span>
            <span className="text-lg font-bold text-emerald-400">{formatEUR(baselineEnd)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300">Custom</span>
            <span className="text-lg font-bold text-violet-400">{formatEUR(customEnd)}</span>
          </div>
          <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-200">Difference</span>
            <span className={`text-lg font-bold ${netWorthDiff >= 0 ? 'text-violet-400' : 'text-emerald-400'}`}>
              {netWorthDiff >= 0 ? '+' : ''}{formatEUR(netWorthDiff)}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            ({netWorthDiffPct >= 0 ? '+' : ''}{netWorthDiffPct.toFixed(1)}%)
          </p>
        </div>
      </div>
      
      {/* Total Cash Flow */}
      <div className="card">
        <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-2">Cumulative Cash Flow</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300">Keep All</span>
            <span className="text-lg font-bold text-emerald-400">{formatEUR(baselineCFTotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300">Custom</span>
            <span className="text-lg font-bold text-violet-400">{formatEUR(customCFTotal)}</span>
          </div>
          <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-200">Difference</span>
            <span className={`text-lg font-bold ${cfDiff >= 0 ? 'text-violet-400' : 'text-emerald-400'}`}>
              {cfDiff >= 0 ? '+' : ''}{formatEUR(cfDiff)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Recommendation */}
      <div className={`card ${customBetter ? 'bg-violet-900/20 border-violet-700' : 'bg-emerald-900/20 border-emerald-700'}`}>
        <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-2">Recommendation</h4>
        <div className="flex items-start gap-3">
          <span className={customBetter ? 'text-violet-400' : 'text-emerald-400'}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={customBetter 
                  ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                } />
            </svg>
          </span>
          <div>
            <p className={`font-semibold text-sm ${customBetter ? 'text-violet-200' : 'text-emerald-200'}`}>
              {customBetter ? 'Custom Strategy Better' : 'Keep All Properties'}
            </p>
            <p className={`text-xs mt-1 ${customBetter ? 'text-violet-300' : 'text-emerald-300'}`}>
              {customBetter 
                ? `Your custom strategy yields ${formatEUR(Math.abs(netWorthDiff))} more after 20 years`
                : `Keeping all properties outperforms by ${formatEUR(Math.abs(netWorthDiff))}`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-slate-300 font-medium">No properties to analyze</p>
      <p className="text-slate-500 text-sm mt-1">Add at least one property to compare scenarios.</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScenarioPlanner({ properties }) {
  // Decision state: { [propertyId]: { action, investmentType, investmentRate, saleYear } }
  const [decisions, setDecisions] = useState({})
  
  // Tax configuration
  const [taxConfig, setTaxConfig] = useState({
    useWithholding: true,
    rentalWithholding: 0.30,
    capitalGainsApplies: true,
    capitalGainsRate: 0.165,
    etfDividendPct: 0
  })
  
  // Initialize decisions for new properties
  useMemo(() => {
    const newDecisions = { ...decisions }
    properties.forEach(p => {
      if (!newDecisions[p.id]) {
        newDecisions[p.id] = {
          action: 'keep',
          investmentType: 'etf',
          investmentRate: INVESTMENT_TYPES.etf.rate,
          saleYear: 0
        }
      }
    })
    setDecisions(newDecisions)
  }, [properties.map(p => p.id).join(',')])
  
  // Build comparison data
  const comparisonData = useMemo(() => {
    if (properties.length === 0) return []
    return buildPropertyScenarioComparison(properties, { decisions, taxConfig })
  }, [properties, decisions, taxConfig])
  
  if (!properties || properties.length === 0) return <EmptyState />
  
  // Find crossover point
  const crossover = comparisonData.find((d, i) => 
    i > 0 && d.customNetWorth > d.baselineNetWorth && comparisonData[i - 1].customNetWorth <= comparisonData[i - 1].baselineNetWorth
  )
  
  // Count decisions
  const sellCount = Object.values(decisions).filter(d => d.action === 'sell').length
  const keepCount = Object.values(decisions).filter(d => d.action === 'keep').length
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Scenario Planner</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Compare property-by-property decisions: keep & rent vs sell & invest
        </p>
      </div>
      
      {/* Scenario summary */}
      <div className="bg-brand-900/20 border border-brand-700 rounded-xl px-4 py-3">
        <p className="text-sm text-brand-200">
          <strong>Current scenario:</strong> {keepCount} propert{keepCount === 1 ? 'y' : 'ies'} kept, {sellCount} sold
        </p>
      </div>
      
      {/* Property cards grid */}
      <div>
        <h2 className="font-semibold text-slate-100 mb-4">Your Properties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              decision={decisions[property.id] || {}}
              onDecisionChange={(newDecision) => 
                setDecisions({ ...decisions, [property.id]: newDecision })
              }
            />
          ))}
        </div>
      </div>
      
      {/* Tax configuration */}
      <TaxConfigPanel config={taxConfig} onChange={setTaxConfig} />
      
      {/* Sale breakdown */}
      <SaleBreakdownCard properties={properties} decisions={decisions} taxConfig={taxConfig} />
      
      {/* Crossover insight */}
      {crossover ? (
        <div className="bg-violet-900/20 border border-violet-700 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-violet-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-sm text-violet-200">
            <strong>Crossover at {crossover.label}</strong> — from this point, your custom strategy outperforms keeping all properties.
          </p>
        </div>
      ) : (
        comparisonData.length > 0 && comparisonData[comparisonData.length - 1].customNetWorth > comparisonData[comparisonData.length - 1].baselineNetWorth ? (
          <div className="bg-violet-900/20 border border-violet-700 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-violet-400 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            <p className="text-sm text-violet-200">
              <strong>Custom strategy outperforms</strong> across the full 20-year horizon.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-emerald-400 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <p className="text-sm text-emerald-200">
              <strong>Keeping all properties outperforms</strong> your custom scenario.
            </p>
          </div>
        )
      )}
      
      {/* Comparison chart */}
      <div className="card">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-100">Keep All vs Custom Strategy</h2>
          <p className="text-xs text-slate-400 mt-0.5">20-year net worth projection</p>
        </div>
        
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={comparisonData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gBaseline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gCustom" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#1e293b' }} tickLine={false} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '12px' }} />
            
            <Area type="monotone" dataKey="baselineNetWorth" name="Keep All"
              stroke="#10b981" strokeWidth={2.5} fill="url(#gBaseline)"
              dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
            
            <Area type="monotone" dataKey="customNetWorth" name="Custom Strategy"
              stroke="#a78bfa" strokeWidth={2.5} fill="url(#gCustom)"
              dot={false} activeDot={{ r: 5, fill: '#a78bfa' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary cards */}
      <SummaryCards data={comparisonData} />
      
      {/* Detailed comparison table */}
      <ComparisonTable data={comparisonData} />
    </div>
  )
}
