import { useState } from 'react'
import {
  AreaChart, Area,
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { buildProjection, formatEUR } from '../utils/projectionUtils'
import { buildTradingProjection } from '../calculations/trading/tradingUtils'
import InfoPopover from './InfoPopover'
import CalculationBreakdown from './CalculationBreakdown'

// ─── Investment projection math (mirrors MoneyFlow.jsx) ──────────────────────

function buildInvProjection(profile, years = 20) {
  const members = profile?.members || []
  // Only "me" member's positions
  const me = members.find((m) => m.isMe) ?? members[0]
  const positions = (me?.investmentPositions || []).filter((p) => (p.monthlyAmount || 0) > 0)

  const result = []
  for (let y = 0; y <= years; y++) {
    let total = 0
    for (const pos of positions) {
      const r = (pos.annualReturn || 0) / 12
      const n = y * 12
      const fv = r === 0
        ? (pos.monthlyAmount || 0) * n
        : (pos.monthlyAmount || 0) * ((Math.pow(1 + r, n) - 1) / r)
      total += Math.round(fv)
    }
    result.push({ year: y, investmentPortfolio: total })
  }
  return result
}

// ─── Explanation texts (single source of truth) ───────────────────────────────

const INFO = {
  propertyValue: (
    <>
      <strong className="text-neo-text block mb-1">Property Value</strong>
      Your current market value grown by the appreciation rate you set, compounded yearly.
      <br /><br />
      <code className="text-brand-300">Value × (1 + rate)^year</code>
      <br /><br />
      Example: €275,000 at 2%/yr → €408,986 after 20 years.
    </>
  ),
  loanBalance: (
    <>
      <strong className="text-neo-text block mb-1">Loan Balance</strong>
      The outstanding capital still owed to the bank at that point in time.
      <br /><br />
      Taken directly from the <strong>amortization schedule</strong> you uploaded (last row with a due date ≤ that year). If no CSV was uploaded, estimated with the standard annuity formula.
    </>
  ),
  netWorth: (
    <>
      <strong className="text-neo-text block mb-1">Net Worth</strong>
      What you would walk away with if you sold everything and repaid all loans.
      <br /><br />
      <code className="text-brand-300">Net Worth = Property Value − Loan Balance</code>
      <br /><br />
      Does <em>not</em> subtract selling costs — see the Scenario Planner for that.
    </>
  ),
  annualCF: (
    <>
      <strong className="text-neo-text block mb-1">Annual Cash Flow</strong>
      The net cash in your pocket for that year, after all income and costs.
      <br /><br />
      <code className="text-brand-300">
        Indexed Rent<br />
        − Indexed Maintenance<br />
        − Indexed Insurance<br />
        − Inflation-adjusted Other Costs<br />
        − Fixed Property Tax<br />
        − Loan Payments (from CSV or annuity)
      </code>
      <br /><br />
      Rent and costs increase each year by the rates you configured. Loan payments are fixed (or follow the uploaded schedule). Property tax is always the same amount.
    </>
  ),
  cumulativeCF: (
    <>
      <strong className="text-neo-text block mb-1">Cumulative Cash Flow</strong>
      The running total of all annual cash flows from today up to that year.
      <br /><br />
      When this line crosses zero, your rental income has fully covered all costs paid so far — your <strong>cash breakeven point</strong>.
    </>
  ),
  propGain: (
    <>
      <strong className="text-neo-text block mb-1">Property Gain (20y)</strong>
      How much more your portfolio is worth after 20 years of appreciation compared to today.
      <br /><br />
      <code className="text-brand-300">Value(+20y) − Value(today)</code>
    </>
  ),
  debtRepaid: (
    <>
      <strong className="text-neo-text block mb-1">Debt Repaid (20y)</strong>
      How much of your total loan principal will have been repaid over 20 years.
      <br /><br />
      <code className="text-brand-300">Loan Balance(today) − Loan Balance(+20y)</code>
    </>
  ),
  netWorthGain: (
    <>
      <strong className="text-neo-text block mb-1">Net Worth Gain (20y)</strong>
      Combined effect of appreciation and debt repayment over 20 years.
      <br /><br />
      <code className="text-brand-300">Net Worth(+20y) − Net Worth(today)</code>
      <br /><br />
      This is your total wealth creation, <em>excluding</em> cash flows.
    </>
  ),
  totalCF: (
    <>
      <strong className="text-neo-text block mb-1">Cumulative Cash Flow (20y)</strong>
      Total cash generated (or consumed) by the portfolio over 20 years.
      <br /><br />
      Negative early on is normal — as rent is indexed upward and loans are repaid, cash flow typically turns positive.
    </>
  ),
  equityGain: (
    <>
      <strong className="text-neo-text block mb-1">Equity Gain</strong>
      How much your net worth increased in this specific year — the combined effect of property appreciation and loan principal repaid.
      <br /><br />
      <code className="text-brand-300">Net Worth(year) − Net Worth(year − 1)</code>
    </>
  ),
  annualCosts: (
    <>
      <strong className="text-neo-text block mb-1">Annual Costs</strong>
      Total cash out for this year: loan payments, maintenance, insurance, property tax, and any other expenses.
      <br /><br />
      This is what owning the property costs you in cash — shown as a negative bar so you can compare it against your equity gain.
    </>
  ),
  totalReturn: (
    <>
      <strong className="text-neo-text block mb-1">Total Return</strong>
      Your true all-in return: equity <em>plus</em> every euro of rent received (or cost paid) so far.
      <br /><br />
      <code className="text-brand-300">Total Return = Net Worth + Cumulative Cash Flow</code>
      <br /><br />
      When this line rises above Net Worth, your rental income is adding meaningful real-world value on top of paper equity.
    </>
  ),
  investmentMonthlyCF: (
    <>
      <strong className="text-neo-text block mb-1">Investment Cash Flow (/mo)</strong>
      Monthly portfolio cash flow from investment properties only, aligned with Growth Planner logic.
      <br /><br />
      Excludes owner-occupied private housing costs.
      <br /><br />
      <code className="text-brand-300">Rental income − opex − loan payments (rental-active properties only)</code>
    </>
  ),
  investmentPortfolio: (
    <>
      <strong className="text-neo-text block mb-1">Investment Portfolio</strong>
      The projected value of your stock/ETF/savings positions from the Household Profile (your positions only).
      <br /><br />
      <code className="text-brand-300">FV = monthly × ((1+r)^n − 1) / r</code>
      <br /><br />
      Assumes constant monthly contributions and fixed annual return. Dividends reinvested. Tax on gains not modelled.
    </>
  ),
  tradingProjection: (
    <>
      <strong className="text-neo-text block mb-1">Trading Portfolio (Revolut)</strong>
      Projected future value of your Revolut trading account, assuming your current holdings compound forward plus your observed average monthly buy amount continues indefinitely.
      <br /><br />
      <code className="text-brand-300">
        FV = currentValue × (1+rate)^Y<br />
        &nbsp;&nbsp;&nbsp;+ monthlyAvg × ((1+r/12)^(Y×12) − 1) / (r/12)
      </code>
      <br /><br />
      Monthly average is derived from your actual BUY trade history. Return rate is adjustable. Tax on gains not modelled.
    </>
  ),
  personalNetWorth: (
    <>
      <strong className="text-neo-text block mb-1">Personal Net Worth</strong>
      Your real estate equity (your ownership share) plus your investment portfolio value at that point in time.
      <br /><br />
      <code className="text-brand-300">= Real Estate Equity (my share) + Investment Portfolio</code>
    </>
  ),
  cfTable: {
    propertyValue:  'Appreciated portfolio value at the start of that year.',
    loanBalance:    'Total outstanding debt across all loans at the start of that year.',
    netWorth:       'Property Value minus Loan Balance — your equity position.',
    annualCF:       'Net cash for this year: indexed rent minus all costs and loan payments.',
    cumulativeCF:   'Running total of all annual cash flows from Year 0 up to this row.',
    totalReturn:    'Net Worth + Cumulative Cash Flow — your true all-in return including both equity and cash generated.',
  },
  breakdownTable: {
    currentValue:  'Market value you entered for this property.',
    v5:            'Current value × (1 + appreciation rate)^5',
    v20:           'Current value × (1 + appreciation rate)^20',
    appRate:       'Annual appreciation rate configured on this property.',
    rentIndex:     'Annual rent indexation rate — how much rent grows each year.',
  },
}

// ─── Shared chart helpers ─────────────────────────────────────────────────────

function formatYAxis(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `€${(value / 1_000).toFixed(0)}k`
  return `€${value}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-neo-raised border border-neo-border rounded-xl p-3 shadow-xl text-xs min-w-[180px]">
      <p className="font-semibold text-neo-text mb-2 text-sm">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }} className="font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-neo-text font-semibold">{formatEUR(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ data, hasInvestments, hasTradingProjection }) {
  const first = data[0]
  const last  = data[data.length - 1]
  const netWorthGain  = last.netWorth - first.netWorth
  const propGain      = last.propertyValue - first.propertyValue
  const loanReduction = first.loanBalance - last.loanBalance
  const totalReturn   = last.totalReturn - first.totalReturn

  const items = [
    {
      label: 'Property gain (20y)',
      value: formatEUR(propGain),
      color: 'text-emerald-400',
      prefix: '+',
      info: INFO.propGain,
    },
    {
      label: 'Debt repaid (20y)',
      value: formatEUR(loanReduction),
      color: 'text-brand-400',
      prefix: '-',
      info: INFO.debtRepaid,
    },
    {
      label: 'Net worth gain (20y)',
      value: formatEUR(netWorthGain),
      color: netWorthGain >= 0 ? 'text-emerald-400' : 'text-red-400',
      prefix: netWorthGain >= 0 ? '+' : '',
      info: INFO.netWorthGain,
    },
    {
      label: 'Total return (20y)',
      value: formatEUR(totalReturn),
      color: totalReturn >= 0 ? 'text-amber-400' : 'text-red-400',
      prefix: totalReturn >= 0 ? '+' : '',
      info: INFO.totalReturn,
    },
  ]

  // Extra investment stats appended when user has investment positions
  if (hasInvestments) {
    const invGain = (last.investmentPortfolio ?? 0) - (first.investmentPortfolio ?? 0)
    const pnwGain = (last.personalNetWorth ?? 0) - (first.personalNetWorth ?? 0)
    items.push(
      {
        label: 'Investment growth (20y)',
        value: formatEUR(invGain),
        color: invGain >= 0 ? 'text-violet-400' : 'text-red-400',
        prefix: invGain >= 0 ? '+' : '',
        info: INFO.investmentPortfolio,
      },
      {
        label: 'Personal NW gain (20y)',
        value: formatEUR(pnwGain),
        color: pnwGain >= 0 ? 'text-fuchsia-400' : 'text-red-400',
        prefix: pnwGain >= 0 ? '+' : '',
        info: INFO.personalNetWorth,
      },
    )
  }

  if (hasTradingProjection) {
    const tradingGain = (last.tradingProjection ?? 0) - (first.tradingProjection ?? 0)
    items.push({
      label: 'Trading portfolio (20y)',
      value: formatEUR(last.tradingProjection ?? 0),
      color: 'text-indigo-400',
      prefix: '',
      info: INFO.tradingProjection,
    })
    items.push({
      label: 'Trading growth (20y)',
      value: formatEUR(tradingGain),
      color: tradingGain >= 0 ? 'text-indigo-300' : 'text-red-400',
      prefix: tradingGain >= 0 ? '+' : '',
      info: INFO.tradingProjection,
    })
  }

  const cols = items.length <= 5 ? 'lg:grid-cols-5' : items.length <= 7 ? 'lg:grid-cols-7' : 'lg:grid-cols-9'

  return (
    <div className={`grid grid-cols-2 ${cols} gap-3 mt-4`}>
      {items.map((item) => (
        <div key={item.label} className="bg-neo-sunken/55 rounded-xl p-3 text-center">
          <p className="text-xs text-neo-muted mb-1 leading-tight flex items-center justify-center gap-0.5">
            {item.label}
            <InfoPopover>{item.info}</InfoPopover>
          </p>
          <p className={`text-base font-bold ${item.color}`}>
            {item.prefix}{item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Property breakdown table ─────────────────────────────────────────────────

function ThWithInfo({ children, info, left = false }) {
  return (
    <th className={`py-2 text-neo-muted font-medium text-xs ${left ? 'text-left pr-3' : 'text-right px-2'}`}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        {info && <InfoPopover>{info}</InfoPopover>}
      </span>
    </th>
  )
}

function PropertyBreakdown({ properties }) {
  return (
    <div className="card overflow-x-auto">
      <h3 className="section-title">Property Breakdown</h3>
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-neo-border">
            <ThWithInfo left>Property</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.currentValue}>Current Value</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.v5}>+5y Value</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.v20}>+20y Value</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.appRate}>Appre. Rate</ThWithInfo>
            <ThWithInfo info={INFO.breakdownTable.rentIndex}>Rent Index</ThWithInfo>
            <ThWithInfo>Loans</ThWithInfo>
          </tr>
        </thead>
        <tbody className="divide-y divide-neo-border/50">
          {properties.map((p) => {
            const r   = p.appreciationRate || 0.02
            const v5  = p.currentValue * Math.pow(1 + r, 5)
            const v20 = p.currentValue * Math.pow(1 + r, 20)
            return (
              <tr key={p.id} className="hover:bg-neo-sunken/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-neo-text/95 whitespace-nowrap">{p.name}</td>
                <td className="py-2 px-2 text-right text-neo-text/95">{formatEUR(p.currentValue)}</td>
                <td className="py-2 px-2 text-right text-emerald-400">{formatEUR(v5)}</td>
                <td className="py-2 px-2 text-right text-emerald-400 font-semibold">{formatEUR(v20)}</td>
                <td className="py-2 px-2 text-right text-neo-muted">{(r * 100).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-neo-muted">{((p.indexationRate ?? 0.02) * 100).toFixed(1)}%</td>
                <td className="py-2 pl-2 text-right text-neo-muted">{p.loans?.length || 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Annual cash flow table ───────────────────────────────────────────────────

function CashFlowTable({ data, hasInvestments, hasTradingProjection }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? data : data.slice(0, 6)

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Annual Cash Flow Detail</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          {expanded ? 'Show less' : 'Show all 20 years'}
        </button>
      </div>
      <table className="w-full text-sm min-w-[620px]">
        <thead>
          <tr className="border-b border-neo-border">
            <ThWithInfo left>Year</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.propertyValue}>Property Value</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.loanBalance}>Loan Balance</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.netWorth}>Net Worth</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.annualCF}>Annual CF</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.cumulativeCF}>Cumulative CF</ThWithInfo>
            <ThWithInfo info={INFO.cfTable.totalReturn}>Total Return</ThWithInfo>
            {hasInvestments && (
              <ThWithInfo info={INFO.investmentPortfolio}>Investments</ThWithInfo>
            )}
            {hasInvestments && (
              <ThWithInfo info={INFO.personalNetWorth}>Personal NW</ThWithInfo>
            )}
            {hasTradingProjection && (
              <ThWithInfo info={INFO.tradingProjection}>Trading</ThWithInfo>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-neo-border/50">
          {rows.map((row) => (
            <tr key={row.year} className="hover:bg-neo-sunken/30 transition-colors">
              <td className="py-2 pr-3 text-neo-muted font-medium">{row.label}</td>
              <td className="py-2 px-2 text-right text-neo-text/95">{formatEUR(row.propertyValue)}</td>
              <td className="py-2 px-2 text-right text-red-400">{formatEUR(row.loanBalance)}</td>
              <td className="py-2 px-2 text-right font-semibold text-neo-text">{formatEUR(row.netWorth)}</td>
              <td className={`py-2 px-2 text-right font-medium ${row.annualCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.annualCashFlow >= 0 ? '+' : ''}{formatEUR(row.annualCashFlow)}
              </td>
              <td className={`py-2 px-2 text-right font-semibold ${row.cumulativeCF >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.cumulativeCF >= 0 ? '+' : ''}{formatEUR(row.cumulativeCF)}
              </td>
              <td className={`py-2 pl-2 text-right font-bold ${row.totalReturn >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {row.totalReturn >= 0 ? '+' : ''}{formatEUR(row.totalReturn)}
              </td>
              {hasInvestments && (
                <td className="py-2 px-2 text-right text-violet-400 font-medium">
                  {formatEUR(row.investmentPortfolio ?? 0)}
                </td>
              )}
              {hasInvestments && (
                <td className="py-2 pl-2 text-right text-fuchsia-400 font-bold">
                  {formatEUR(row.personalNetWorth ?? 0)}
                </td>
              )}
              {hasTradingProjection && (
                <td className="py-2 px-2 text-right text-indigo-400 font-medium">
                  {formatEUR(row.tradingProjection ?? 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Chart legend with info popovers ─────────────────────────────────────────

function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-neo-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: item.color }} />
          {item.label}
          <InfoPopover>{item.info}</InfoPopover>
        </span>
      ))}
    </div>
  )
}

// ─── Chart 2a: Cash flow (rented / mixed) ────────────────────────────────────

function CashFlowChart({ data }) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-neo-text">Net Cash Flow per Year</h2>
          <p className="text-xs text-neo-muted mt-0.5">Indexed rent minus indexed costs and loan payments</p>
        </div>
        <ChartLegend items={[
          { label: 'Annual CF',     color: '#0ea5e9', info: INFO.annualCF },
          { label: 'Cumulative CF', color: '#a78bfa', info: INFO.cumulativeCF },
        ]} />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
          <YAxis yAxisId="left"  tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
          <YAxis yAxisId="right" tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeDasharray="4 2" />
          <Bar  yAxisId="left"  dataKey="annualCashFlow" name="Annual CF"    fill="#0ea5e9" radius={[4,4,0,0]} maxBarSize={32} />
          <Line yAxisId="right" type="monotone" dataKey="cumulativeCF" name="Cumulative CF" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Chart 2b: Equity growth (non-rented) ────────────────────────────────────

function EquityGrowthChart({ data }) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-neo-text">Equity Growth per Year</h2>
          <p className="text-xs text-neo-muted mt-0.5">
            Annual equity gain (appreciation + loan paydown) and total annual costs to own
          </p>
        </div>
        <ChartLegend items={[
          { label: 'Equity Gain',   color: '#10b981', info: INFO.equityGain },
          { label: 'Annual Costs',  color: '#f87171', info: INFO.annualCosts },
          { label: 'Net Worth',     color: '#38bdf8', info: INFO.netWorth },
        ]} />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data.slice(1)} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
          <YAxis yAxisId="left"  tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
          <YAxis yAxisId="right" tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeDasharray="4 2" />
          {/* Stacked bars: equity gain (positive) vs costs (negative) */}
          <Bar yAxisId="left" dataKey="equityGain"  name="Equity Gain"  fill="#10b981" radius={[4,4,0,0]} maxBarSize={32} />
          <Bar yAxisId="left" dataKey={(d) => -d.annualCosts} name="Annual Costs" fill="#f87171" radius={[4,4,0,0]} maxBarSize={32} />
          {/* Net worth on right axis */}
          <Line yAxisId="right" type="monotone" dataKey="netWorth" name="Net Worth" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-neo-sunken flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-neo-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <p className="text-neo-muted font-medium">No data to project yet</p>
      <p className="text-neo-subtle text-sm mt-1">Add at least one property to see the 20-year chart.</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Derive planned investment reference line labels ──────────────────────────

function getInvestmentMarkers(properties) {
  const today = new Date()
  // Collect unique year offsets with a label like "+3y: Kitchen (€15k)"
  const byYear = {}
  for (const p of properties) {
    for (const inv of p.plannedInvestments || []) {
      const invDate = new Date(inv.plannedDate)
      const yearOffset = Math.floor(
        (invDate.getFullYear() - today.getFullYear()) +
        (invDate.getMonth() - today.getMonth()) / 12
      )
      if (yearOffset < 0 || yearOffset > 20) continue
      const label = yearOffset === 0 ? 'Today' : `+${yearOffset}y`
      if (!byYear[label]) byYear[label] = []
      byYear[label].push(inv)
    }
  }
  return byYear  // { "+3y": [inv, ...], ... }
}

export default function ProjectionChart({ properties, profile, trades = [], tradingPortfolioValue = 0 }) {
  const [inflationAdjusted, setInflationAdjusted] = useState(false)
  const [stockReturnRate, setStockReturnRate] = useState(0.07)

  if (!properties || properties.length === 0) return <EmptyState />

  const data = buildProjection(properties)
  const investmentMarkers = getInvestmentMarkers(properties)

  // Build investment projection from household profile (manual positions)
  const invData = buildInvProjection(profile)
  const hasInvestments = invData.some((d) => d.investmentPortfolio > 0)

  // Build trading portfolio projection from Revolut trade history
  const tradingData = buildTradingProjection(trades, tradingPortfolioValue, 20, stockReturnRate)
  const hasTradingProjection = tradingPortfolioValue > 0 || tradingData.some((d) => d.tradingProjection > 0)

  // Merge: add investmentPortfolio, tradingProjection, and personalNetWorth to each year point
  // personalNetWorth = my share of real estate equity + investment portfolio
  const mergedData = data.map((pt, i) => {
    const inv     = invData[i]?.investmentPortfolio ?? 0
    const trading = tradingData[i]?.tradingProjection ?? 0
    // My share of real estate equity
    let myEquity = pt.netWorth  // fallback: assume 100% ownership
    if (properties.length > 0) {
      // Weighted by ownership share
      // Re-derive: sum(currentValue × share × appreciationFactor) − sum(loanBalance × share)
      // For simplicity, use the same share as computeSummary does (first "Me" owner or owner[0])
      // We approximate by scaling total netWorth by the average personal share
      const totalValue = properties.reduce((s, p) => s + (p.currentValue || 0), 0)
      if (totalValue > 0) {
        const myValueToday = properties.reduce((s, p) => {
          const owners  = p.owners || [{ name: 'Me', share: 1 }]
          const myOwner = owners.find((o) => /^me$/i.test(o.name?.trim())) ?? owners[0]
          return s + (p.currentValue || 0) * Number(myOwner?.share ?? 1)
        }, 0)
        const myShareFraction = myValueToday / totalValue
        myEquity = Math.round(pt.netWorth * myShareFraction)
      }
    }
    return { ...pt, investmentPortfolio: inv, tradingProjection: trading, personalNetWorth: myEquity + inv }
  })

  // Apply inflation adjustment if toggle is enabled
  // Adjust all monetary values to today's purchasing power using 2% global inflation
  const GLOBAL_INFLATION_RATE = 0.02
  const displayData = inflationAdjusted
    ? mergedData.map((pt) => {
        const inflationFactor = Math.pow(1 + GLOBAL_INFLATION_RATE, pt.year)
        return {
          ...pt,
          propertyValue: Math.round(pt.propertyValue / inflationFactor),
          loanBalance: Math.round(pt.loanBalance / inflationFactor),
          netWorth: Math.round(pt.netWorth / inflationFactor),
          equityGain: Math.round(pt.equityGain / inflationFactor),
          annualCashFlow: Math.round(pt.annualCashFlow / inflationFactor),
          annualCosts: Math.round(pt.annualCosts / inflationFactor),
          cumulativeCF: Math.round(pt.cumulativeCF / inflationFactor),
          investmentAnnualCashFlow: Math.round((pt.investmentAnnualCashFlow ?? 0) / inflationFactor),
          investmentMonthlyCashFlow: Math.round((pt.investmentMonthlyCashFlow ?? 0) / inflationFactor),
          plannedInvestCost: Math.round(pt.plannedInvestCost / inflationFactor),
          totalReturn: Math.round(pt.totalReturn / inflationFactor),
          investmentPortfolio: Math.round(pt.investmentPortfolio / inflationFactor),
          tradingProjection: Math.round(pt.tradingProjection / inflationFactor),
          personalNetWorth: Math.round(pt.personalNetWorth / inflationFactor),
        }
      })
    : mergedData


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neo-text">20-Year Projection</h1>
          <p className="text-neo-muted text-sm mt-0.5">
            Indexed rental income, inflation-adjusted costs, and amortization-based loan balance.
            Click any <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neo-sunken text-[10px] font-bold text-neo-muted mx-0.5">?</span> for a detailed explanation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Stock return rate selector (shown only when trading data is present) */}
          {hasTradingProjection && (
            <div className="flex items-center gap-2 bg-neo-sunken/60 px-4 py-2.5 rounded-lg border border-neo-border/50">
              <label htmlFor="stock-return-rate" className="text-sm text-neo-muted font-medium whitespace-nowrap flex items-center gap-1">
                Trading return rate
                <InfoPopover>{INFO.tradingProjection}</InfoPopover>
              </label>
              <select
                id="stock-return-rate"
                value={stockReturnRate}
                onChange={(e) => setStockReturnRate(Number(e.target.value))}
                className="bg-neo-sunken border border-neo-border text-neo-text text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={0.04}>4% (conservative)</option>
                <option value={0.05}>5%</option>
                <option value={0.06}>6%</option>
                <option value={0.07}>7% (default)</option>
                <option value={0.08}>8%</option>
                <option value={0.09}>9%</option>
                <option value={0.10}>10% (optimistic)</option>
              </select>
            </div>
          )}

          {/* Inflation Toggle */}
          <div className="flex items-center gap-3 bg-neo-sunken/60 px-4 py-2.5 rounded-lg border border-neo-border/50">
            <label htmlFor="inflation-toggle" className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-neo-muted font-medium">Adjust for Inflation</span>
              <InfoPopover>
                <strong className="text-neo-text block mb-1">Inflation Adjustment</strong>
                When enabled, all future values are adjusted to today's purchasing power using a 2% annual inflation rate.
                <br /><br />
                This shows you the <strong>real value</strong> of your money, accounting for how inflation reduces purchasing power over time.
                <br /><br />
                <code className="text-brand-300">Real Value = Nominal Value ÷ (1.02)^year</code>
                <br /><br />
                Example: €100,000 in 20 years = €67,297 in today's money.
              </InfoPopover>
            </label>
            <button
              id="inflation-toggle"
              role="switch"
              aria-checked={inflationAdjusted}
              onClick={() => setInflationAdjusted(!inflationAdjusted)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-neo-bg ${
                inflationAdjusted ? 'bg-brand-500' : 'bg-neo-sunken'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  inflationAdjusted ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Chart 1: Portfolio Value vs Debt — stacked bar ── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-neo-text">Portfolio Value vs. Debt</h2>
            <p className="text-xs text-neo-muted mt-0.5">
              Each bar = total wealth stack: debt (red) → real estate equity (green){hasInvestments ? ' → manual investments (purple)' : ''}{hasTradingProjection ? ' → trading portfolio (indigo)' : ''}.
              Dashed amber line = total return. Blue line = investment cash flow per month (excl. owner-occupied properties).
            </p>
          </div>
          <ChartLegend items={[
            { label: 'Equity (Net Worth)',   color: '#10b981', info: INFO.netWorth },
            { label: 'Loan Balance',         color: '#ef4444', info: INFO.loanBalance },
            ...(hasInvestments ? [
              { label: 'Investment Portfolio', color: '#a78bfa', info: INFO.investmentPortfolio },
            ] : []),
            ...(hasTradingProjection ? [
              { label: 'Trading Portfolio', color: '#6366f1', info: INFO.tradingProjection },
            ] : []),
            { label: 'Total Return',         color: '#f59e0b', info: INFO.totalReturn },
            { label: 'Investment CF / mo',   color: '#06b6d4', info: INFO.investmentMonthlyCF },
          ]} />
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={displayData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis yAxisId="left" tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={formatYAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
            <Tooltip content={<CustomTooltip />} />
            {/* Stacked bars: loan (red) → real estate equity (green) → investments (purple) → trading (indigo) */}
            <Bar yAxisId="left" dataKey="loanBalance"        name="Loan Balance"         stackId="value" fill="#ef4444" fillOpacity={0.85} radius={[0,0,0,0]} />
            <Bar yAxisId="left" dataKey="netWorth"           name="Equity (Net Worth)"   stackId="value" fill="#10b981" fillOpacity={0.85} radius={(hasInvestments || hasTradingProjection) ? [0,0,0,0] : [4,4,0,0]} />
            {hasInvestments && (
              <Bar yAxisId="left" dataKey="investmentPortfolio" name="Investment Portfolio" stackId="value" fill="#a78bfa" fillOpacity={0.85} radius={hasTradingProjection ? [0,0,0,0] : [4,4,0,0]} />
            )}
            {hasTradingProjection && (
              <Bar yAxisId="left" dataKey="tradingProjection" name="Trading Portfolio" stackId="value" fill="#6366f1" fillOpacity={0.85} radius={[4,4,0,0]} />
            )}
            {/* Total Return line overlaid */}
            <Line yAxisId="left" type="monotone" dataKey="totalReturn" name="Total Return" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#f59e0b' }} strokeDasharray="5 3" />
            <Line yAxisId="right" type="monotone" dataKey="investmentMonthlyCashFlow" name="Investment CF / mo" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#06b6d4' }} />
            {/* Planned investment markers */}
            {Object.entries(investmentMarkers).map(([label, invs]) => (
              <ReferenceLine
                key={label}
                x={label}
                yAxisId="left"
                stroke="#fbbf24"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{
                  value: `🔨 ${invs.length > 1 ? `${invs.length} investments` : (invs[0].description || 'Investment')}`,
                  position: 'insideTopRight',
                  fill: '#fbbf24',
                  fontSize: 10,
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        <SummaryStrip data={displayData} hasInvestments={hasInvestments} hasTradingProjection={hasTradingProjection} />
      </div>

      {/* ── Chart 2: Cash Flow (only when portfolio has rented properties) ── */}
      {properties.some((p) => p.isRented !== false) && (
        <CashFlowChart data={displayData} />
      )}

      {/* ── Chart 3: Equity Growth (always shown) ── */}
      <EquityGrowthChart data={displayData} />

      {/* ── Calculation Breakdown ── */}
      {displayData.length > 0 && (
        <CalculationBreakdown 
          baselineData={displayData[displayData.length - 1]}
          type="keep-all"
        />
      )}

      {/* ── Tables ── */}
      <PropertyBreakdown properties={properties} />
      <CashFlowTable data={displayData} hasInvestments={hasInvestments} hasTradingProjection={hasTradingProjection} />
    </div>
  )
}
