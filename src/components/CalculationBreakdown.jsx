import { useState } from 'react'
import { formatEUR } from '../utils/projectionUtils'
import InfoTooltip from './InfoTooltip'

/**
 * CalculationBreakdown Component
 * 
 * Shows a detailed breakdown of what's included in scenario calculations
 * 
 * @param {Object} baselineData - The baseline projection data point
 * @param {Object} customData - The custom scenario data point (optional)
 * @param {string} type - 'keep-all' or 'comparison'
 */
export default function CalculationBreakdown({ baselineData, customData, type = 'keep-all' }) {
  const [expanded, setExpanded] = useState(false)

  if (!baselineData) return null

  const isComparison = type === 'comparison' && customData

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left hover:bg-slate-700/30 -m-4 p-4 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="font-semibold text-slate-100 text-sm">
            {isComparison ? 'Calculation Breakdown' : 'What\'s Included in "Keep All"'}
          </h3>
          <InfoTooltip
            content={
              <div>
                <p className="font-semibold mb-1.5">Detailed calculation breakdown</p>
                <p>Click to see exactly what's included in the net worth and cash flow calculations for year {baselineData.year}.</p>
              </div>
            }
          />
        </div>
        <span className="text-xs text-slate-500">
          {expanded ? 'Hide' : 'Show'} details
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Keep All / Baseline Breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                Keep All Strategy
              </h4>
            </div>

            {/* Assets */}
            <div className="bg-slate-700/30 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Assets</span>
                  <InfoTooltip
                    content={
                      <div>
                        <p className="font-semibold mb-1">Property Value</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                          <li>Properties appreciate at their appreciation rate (typically 2%/year)</li>
                          <li>Includes any planned investment value increases (renovations, improvements)</li>
                          <li>Calculated as: Base Value × (1 + rate)^years + Planned Investment Value Bumps</li>
                        </ul>
                      </div>
                    }
                  />
                </div>
                <span className="text-sm font-bold text-white">
                  {formatEUR(baselineData.propertyValue || 0)}
                </span>
              </div>
            </div>

            {/* Liabilities */}
            <div className="bg-slate-700/30 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-300">Liabilities</span>
                  <InfoTooltip
                    content={
                      <div>
                        <p className="font-semibold mb-1">Loan Balances</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                          <li>Remaining mortgage balance for all loans</li>
                          <li>Decreases over time as you pay down principal</li>
                          <li>Interest is calculated based on loan terms (fixed, variable, interest-only)</li>
                        </ul>
                      </div>
                    }
                  />
                </div>
                <span className="text-sm font-bold text-red-400">
                  -{formatEUR(baselineData.loanBalance || 0)}
                </span>
              </div>
            </div>

            {/* Net Worth */}
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-emerald-300">Net Worth</span>
                  <InfoTooltip
                    content={
                      <div>
                        <p className="font-semibold mb-1">Net Worth = Assets - Liabilities</p>
                        <p className="text-slate-300">This is your equity in all properties combined.</p>
                      </div>
                    }
                  />
                </div>
                <span className="text-base font-bold text-emerald-400">
                  {formatEUR(baselineData.netWorth || 0)}
                </span>
              </div>
            </div>

            {/* Cash Flow Components */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold text-slate-300">Annual Cash Flow Components</span>
                <InfoTooltip
                  content={
                    <div>
                      <p className="font-semibold mb-1">Cash Flow Calculation</p>
                      <p className="text-slate-300 mb-2">Shows the actual money flowing in and out each year.</p>
                      <p className="text-xs text-slate-400">Formula: Income - Expenses - Investment Costs</p>
                    </div>
                  }
                />
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
                {/* Income */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Rental Income</span>
                    <InfoTooltip
                      size="sm"
                      content={
                        <div>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                            <li>Monthly rent × 12</li>
                            <li>Indexed for inflation (typically 2%/year)</li>
                            <li>Adjusted for vacancy rate (typically 5%)</li>
                            <li>Only from rented properties</li>
                          </ul>
                        </div>
                      }
                    />
                  </div>
                  <span className="text-white font-medium">
                    +{formatEUR(baselineData.annualCashFlow >= 0 
                      ? (baselineData.annualCashFlow + (baselineData.annualCosts || 0)) 
                      : Math.abs(baselineData.annualCashFlow - (baselineData.annualCosts || 0)))}
                  </span>
                </div>

                {/* Expenses */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Operating Expenses</span>
                    <InfoTooltip
                      size="sm"
                      content={
                        <div>
                          <p className="font-semibold mb-1">Includes:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                            <li>Maintenance costs (indexed for inflation)</li>
                            <li>Insurance (indexed for inflation)</li>
                            <li>Property taxes (fixed, not indexed)</li>
                            <li>Loan payments (principal + interest)</li>
                            <li>Monthly expenses (indexed for inflation)</li>
                          </ul>
                        </div>
                      }
                    />
                  </div>
                  <span className="text-red-400 font-medium">
                    -{formatEUR(baselineData.annualCosts || 0)}
                  </span>
                </div>

                {baselineData.plannedInvestCost > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Planned Investments</span>
                      <InfoTooltip
                        size="sm"
                        content={
                          <div>
                            <p className="text-slate-300">One-off cash outflows for renovations, improvements, or other planned investments in your properties this year.</p>
                          </div>
                        }
                      />
                    </div>
                    <span className="text-red-400 font-medium">
                      -{formatEUR(baselineData.plannedInvestCost)}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-600 pt-2 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">Net Cash Flow</span>
                  <span className={`text-sm font-bold ${baselineData.annualCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {baselineData.annualCashFlow >= 0 ? '+' : ''}{formatEUR(baselineData.annualCashFlow || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-300">Cumulative Cash Flow</span>
                    <InfoTooltip
                      size="sm"
                      content={
                        <div>
                          <p className="text-slate-300">The total sum of all annual cash flows from year 0 to year {baselineData.year}.</p>
                        </div>
                      }
                    />
                  </div>
                  <span className={`text-sm font-bold ${baselineData.cumulativeCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {baselineData.cumulativeCF >= 0 ? '+' : ''}{formatEUR(baselineData.cumulativeCF || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Return */}
            <div className="bg-brand-900/20 border border-brand-700 rounded-lg p-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-brand-300">Total Return</span>
                  <InfoTooltip
                    content={
                      <div>
                        <p className="font-semibold mb-1">Net Worth + Cumulative Cash Flow</p>
                        <p className="text-slate-300">This represents your total wealth creation: equity gained plus all cash generated over time.</p>
                      </div>
                    }
                  />
                </div>
                <span className="text-base font-bold text-brand-400">
                  {formatEUR(baselineData.totalReturn || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Custom Strategy Breakdown (if comparison) */}
          {isComparison && (
            <div className="border-t border-slate-600 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wide">
                  Custom Strategy
                </h4>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
                {/* Property Value */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Property Value (kept)</span>
                    <InfoTooltip
                      size="sm"
                      content={
                        <div>
                          <p className="text-slate-300">Value of properties you decided to keep (not sell).</p>
                        </div>
                      }
                    />
                  </div>
                  <span className="text-white font-medium">
                    {formatEUR(customData.propertyValue || 0)}
                  </span>
                </div>

                {/* Investment Value */}
                {customData.investmentValue > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Investment Value (sold)</span>
                      <InfoTooltip
                        size="sm"
                        content={
                          <div>
                            <p className="text-slate-300 mb-2">Proceeds from sold properties, compounded at your chosen investment rate (ETF, bonds, savings, etc.).</p>
                            <p className="text-xs text-slate-400">Includes ETF/dividend taxes if applicable.</p>
                          </div>
                        }
                      />
                    </div>
                    <span className="text-white font-medium">
                      {formatEUR(customData.investmentValue)}
                    </span>
                  </div>
                )}

                {/* Loan Balance */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Loan Balance</span>
                  </div>
                  <span className="text-red-400 font-medium">
                    -{formatEUR(customData.loanBalance || 0)}
                  </span>
                </div>

                <div className="border-t border-slate-600 pt-2 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">Net Worth</span>
                  <span className="text-sm font-bold text-violet-400">
                    {formatEUR(customData.netWorth || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">Cumulative Cash Flow</span>
                  <span className={`text-sm font-bold ${customData.cumulativeCF >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                    {customData.cumulativeCF >= 0 ? '+' : ''}{formatEUR(customData.cumulativeCF || 0)}
                  </span>
                </div>

                {customData.investmentTax > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Investment Tax Paid</span>
                      <InfoTooltip
                        size="sm"
                        content={
                          <div>
                            <p className="text-slate-300">Belgian tax on ETF/dividend income (TOB + dividend withholding if configured).</p>
                          </div>
                        }
                      />
                    </div>
                    <span className="text-red-400 font-medium">
                      -{formatEUR(customData.investmentTax)}
                    </span>
                  </div>
                )}
              </div>

              {/* Comparison Delta */}
              <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Net Worth Difference</span>
                  <span className={`text-base font-bold ${(customData.netWorth - baselineData.netWorth) >= 0 ? 'text-violet-400' : 'text-emerald-400'}`}>
                    {(customData.netWorth - baselineData.netWorth) >= 0 ? '+' : ''}
                    {formatEUR(customData.netWorth - baselineData.netWorth)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Custom strategy is {Math.abs(customData.netWorth - baselineData.netWorth) < 1000 
                    ? 'roughly equivalent' 
                    : (customData.netWorth > baselineData.netWorth ? 'better' : 'worse')} than keeping all properties
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
