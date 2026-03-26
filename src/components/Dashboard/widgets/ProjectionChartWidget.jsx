/**
 * ProjectionChartWidget — switchable area chart (Net Worth / Investment Ready / Cash Flow).
 * Owns its own chart state; persists activeChart to profile on change.
 *
 * @see interfaces.js → DashboardContext for ctx shape
 */

import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { motion } from 'motion/react'
import { ChartWidgetConfig } from '../WidgetConfig'
import { CHARTS, SOFT_EASE } from '../utils/constants'
import { kFmt } from '../utils/formatters'
import { getLoanKey } from '../utils/loanUtils'
import { getRemainingBalance } from '../../../utils/projectionUtils'
import {
  generateNetWorthProjection,
  generateInvestmentReadyProjection,
  generateCashFlowProjection,
} from '../utils/chartGenerators'
import ChartTooltip from '../components/ChartTooltip'
import ChartPickerDropdown from './components/ChartPickerDropdown'
import LoanPickerDropdown from './components/LoanPickerDropdown'

export const widgetConfig = new ChartWidgetConfig({
  id:             'projection_chart',
  title:          'Projection',
  description:    'Net worth, investment-ready capital, or monthly cash flow over time',
  category:       'overview',
  defaultEnabled: true,
  defaultLayout: {
    lg: { x: 0, y: 5, w: 5, h: 6 },
    md: { x: 0, y: 5, w: 8, h: 6 },
    sm: { x: 0, y: 8, w: 4, h: 6 },
    xs: { x: 0, y: 8, w: 4, h: 6 },
  },
  minW: 3,
  minH: 4,
  chartTypes: CHARTS,
})

/** @param {{ ctx: import('../interfaces').DashboardContext }} props */
export default function ProjectionChartWidget({ ctx }) {
  const { properties, profile, onSaveProfile } = ctx

  const [chartRange,      setChartRange]      = useState(10)
  const [activeChart,     setActiveChart]     = useState(profile?.dashboardChart ?? 'net_worth')
  const [chartPickerOpen, setChartPickerOpen] = useState(false)
  const [loanPickerOpen,  setLoanPickerOpen]  = useState(false)
  const [excludedLoanKeys, setExcludedLoanKeys] = useState([])

  const loanOptions = useMemo(() => (
    properties
      .filter((p) => p.status !== 'planned' || Boolean(p.purchaseDate))
      .flatMap((property) =>
        (property.loans || []).map((loan, idx) => ({
          key:            getLoanKey(property, loan, idx),
          propertyLabel:  property.name || property.address || 'Property',
          loanLabel:      `Loan ${idx + 1}`,
          monthlyPayment: loan.monthlyPayment || 0,
          startDate:      loan.startDate || '',
          termMonths:     loan.termMonths || 0,
        }))
      )
  ), [properties])

  useEffect(() => {
    const valid = new Set(loanOptions.map((l) => l.key))
    setExcludedLoanKeys((prev) => prev.filter((k) => valid.has(k)))
  }, [loanOptions])

  const includedLoanKeys = useMemo(() => {
    const excluded = new Set(excludedLoanKeys)
    return new Set(loanOptions.map((l) => l.key).filter((k) => !excluded.has(k)))
  }, [loanOptions, excludedLoanKeys])

  const includedLoanMonthlyEstimate = useMemo(() => (
    loanOptions.reduce((sum, loan) => includedLoanKeys.has(loan.key) ? sum + (loan.monthlyPayment || 0) : sum, 0)
  ), [loanOptions, includedLoanKeys])

  const currentExpenseBreakdown = useMemo(() => {
    const todayISO = new Date().toISOString()
    const selectedLoanMonthlyToday = properties.reduce((sum, property) =>
      sum + (property.loans || []).reduce((loanSum, loan, idx) => {
        const key = getLoanKey(property, loan, idx)
        if (!includedLoanKeys.has(key)) return loanSum
        const remaining = getRemainingBalance(loan, todayISO)
        return remaining <= 0 ? loanSum : loanSum + (loan.monthlyPayment || 0)
      }, 0), 0)
    const rentMonthly = (ctx.summary.annualRentalIncome || 0) / 12
    const opexMonthly = (ctx.summary.annualOpex || 0) / 12
    return { rentMonthly, opexMonthly, selectedLoanMonthlyToday, netMonthly: rentMonthly - opexMonthly - selectedLoanMonthlyToday }
  }, [properties, includedLoanKeys, ctx.summary])

  const chartData = useMemo(() => {
    if (activeChart === 'investment_ready') return generateInvestmentReadyProjection(properties, ctx.summary.personalCash, chartRange)
    if (activeChart === 'cashflow')         return generateCashFlowProjection(properties, chartRange, includedLoanKeys)
    return generateNetWorthProjection(properties, ctx.summary.personalCash, chartRange)
  }, [properties, ctx.summary.personalCash, chartRange, activeChart, includedLoanKeys])

  function handleChartSelect(id) {
    setActiveChart(id)
    setChartPickerOpen(false)
    if (id !== 'cashflow') setLoanPickerOpen(false)
    if (onSaveProfile && profile) onSaveProfile({ ...profile, dashboardChart: id })
  }

  const activeChartMeta = CHARTS.find(c => c.id === activeChart)
  const endValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-40">
        <button onClick={() => setChartPickerOpen(o => !o)} className="flex items-start gap-1.5 group text-left">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-neo-text group-hover:text-brand-400 transition-colors">
                {activeChartMeta?.label ?? 'Projection'}
              </h2>
              <svg className={`w-3.5 h-3.5 text-neo-subtle group-hover:text-brand-400 transition-all duration-200 ${chartPickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-neo-subtle mt-0.5">{activeChartMeta?.sub}</p>
          </div>
        </button>

        <div className="flex gap-1.5 shrink-0">
          {[5, 10, 25].map((y) => (
            <button key={y} onClick={() => setChartRange(y)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all
                ${chartRange === y ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20' : 'text-neo-subtle hover:text-neo-muted border border-transparent'}`}>
              {y}Y
            </button>
          ))}
          {activeChart === 'cashflow' && loanOptions.length > 0 && (
            <button onClick={() => setLoanPickerOpen(o => !o)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all border
                ${loanPickerOpen ? 'bg-brand-600/15 text-brand-400 border-brand-500/20' : 'text-neo-subtle hover:text-neo-muted border-white/[0.08]'}`}>
              Loans {includedLoanKeys.size}/{loanOptions.length}
            </button>
          )}
        </div>
      </div>

      {/* Dropdowns */}
      <ChartPickerDropdown
        open={chartPickerOpen} activeChart={activeChart} onSelect={handleChartSelect}
        includedLoanKeys={includedLoanKeys} loanOptions={loanOptions}
        includedLoanMonthlyEstimate={includedLoanMonthlyEstimate}
        currentExpenseBreakdown={currentExpenseBreakdown}
      />
      <LoanPickerDropdown
        open={activeChart === 'cashflow' && loanPickerOpen}
        loanOptions={loanOptions} includedLoanKeys={includedLoanKeys}
        onToggle={(key) => setExcludedLoanKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
        onSelectAll={() => setExcludedLoanKeys([])}
        onSelectNone={() => setExcludedLoanKeys(loanOptions.map(l => l.key))}
      />

      {/* End-value badge */}
      {Math.abs(endValue) > 0 && (
        <div className="relative h-0">
          <div className="absolute right-14 -top-1 z-10">
            <div className="bg-brand-600/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-glow-sm">
              <p className="text-white text-xs font-bold tabular-nums">
                {activeChart === 'cashflow' ? `${kFmt(endValue)}/mo` : kFmt(endValue)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <motion.div className="flex-1 min-h-0" whileHover={{ scale: 1.01 }} transition={{ duration: 0.2, ease: SOFT_EASE }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 28, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ea580c" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8897b5', fontSize: 11 }} axisLine={false} tickLine={false}
              interval={chartRange <= 5 ? 0 : Math.floor(chartRange / 5)} />
            <YAxis tickFormatter={activeChart === 'cashflow' ? kFmt : kFmt}
              tick={{ fill: '#8897b5', fontSize: 11 }} axisLine={false} tickLine={false} width={54} />
            <Tooltip content={<ChartTooltip suffix={activeChart === 'cashflow' ? '/mo' : ''} />}
              cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2.5}
              fill="url(#valueGrad)" dot={false}
              activeDot={{ r: 5, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }}
              style={{ filter: 'drop-shadow(0 0 6px rgba(234,88,12,0.5))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  )
}
