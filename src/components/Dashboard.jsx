import { computeSummary, formatEUR, isRentalActiveOn, getLoanPaymentSplit } from '../utils/projectionUtils'
import { getStatusMeta, isPrimaryResidenceOn } from './PropertyForm'
import InfoPopover from './InfoPopover'

// ─── Tooltip content ───────────────────────────────────────────────────────────

const INFO = {
  totalPortfolioValue: (
    <>
      <strong className="text-white">Total Portfolio Value</strong>
      <p className="mt-1">The sum of the current market values of all your properties as entered in each property's settings.</p>
      <p className="mt-1 text-slate-400">This is what you estimate the properties are worth today — not what you paid for them.</p>
    </>
  ),
  totalDebt: (
    <>
      <strong className="text-white">Total Debt</strong>
      <p className="mt-1">The total outstanding loan balances across all properties today.</p>
      <p className="mt-1 text-slate-400">If you uploaded an amortization schedule (CSV), the exact balance at today's date is used. Otherwise the original loan amount is shown.</p>
    </>
  ),
  netWorth: (
    <>
      <strong className="text-white">Net Worth (Real Estate)</strong>
      <p className="mt-1 font-mono text-slate-300">= Portfolio Value − Total Debt</p>
      <p className="mt-1">The equity you own across your entire portfolio. This is what you'd pocket (before taxes and fees) if you sold everything and paid off all loans today.</p>
    </>
  ),
  netCashFlow: (
    <>
      <strong className="text-white">Net Cash Flow</strong>
      <p className="mt-1 font-mono text-slate-300">= Rent − Operating Costs − Loan Interest</p>
      <p className="mt-1">Monthly cash your portfolio generates after costs. Loan <em>capital repayment</em> is not counted as a cost — it builds equity.</p>
      <ul className="mt-1.5 space-y-0.5 text-slate-400 list-disc list-inside">
        <li>Only includes rent from <strong>active</strong> rentals (respects rental start date)</li>
        <li>Includes maintenance, insurance, property tax, syndic</li>
        <li>Interest = true cost; capital = equity investment</li>
      </ul>
    </>
  ),
  ltv: (
    <>
      <strong className="text-white">Loan-to-Value (LTV)</strong>
      <p className="mt-1 font-mono text-slate-300">= Total Debt / Portfolio Value × 100</p>
      <p className="mt-1">The percentage of your portfolio that is financed by debt.</p>
      <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
        <li className="text-emerald-400">&lt; 60% — low risk</li>
        <li className="text-orange-400">60–80% — moderate</li>
        <li className="text-red-400">&gt; 80% — high leverage</li>
      </ul>
    </>
  ),
  roeSecondary: (
    <>
      <strong className="text-white">Return on Equity (ROE)</strong>
      <p className="mt-1 font-mono text-slate-300">= Annual Net CF / Equity × 100</p>
      <p className="mt-1">Annual net cash flow divided by the total equity in your portfolio.</p>
      <p className="mt-1 text-slate-400">Measures how productively your equity is working. Rule of thumb: above 4–5% is solid for Belgian residential real estate.</p>
    </>
  ),
  netYield: (
    <>
      <strong className="text-white">Net Yield</strong>
      <p className="mt-1 font-mono text-slate-300">= Annual Net CF / Portfolio Value × 100</p>
      <p className="mt-1">Annual net cash flow as a percentage of total portfolio value — independent of leverage. Useful for comparing properties with other asset classes.</p>
    </>
  ),
  marketValue: (
    <>
      <strong className="text-white">Market Value</strong>
      <p className="mt-1">Your estimate of what this property is worth today. Update it as prices change.</p>
    </>
  ),
  equity: (
    <>
      <strong className="text-white">Equity</strong>
      <p className="mt-1 font-mono text-slate-300">= Market Value − Loan Balance(s)</p>
      <p className="mt-1">How much of the property you actually own outright. Grows as the value appreciates and as you repay loans.</p>
    </>
  ),
  monthlyCF: (
    <>
      <strong className="text-white">Monthly Cash Flow</strong>
      <p className="mt-1 font-mono text-slate-300">= Rent − Operating Costs − Loan Interest</p>
      <p className="mt-1 text-slate-400">Capital repayment is excluded — it builds equity rather than leaving your hands.</p>
      <ul className="mt-1.5 space-y-0.5 text-slate-400 list-disc list-inside">
        <li>€0 rent if rental hasn't started yet</li>
        <li>Includes maintenance, insurance, syndic ÷ 12</li>
        <li>Interest only from loans (not full payment)</li>
      </ul>
    </>
  ),
  appreciation: (
    <>
      <strong className="text-white">Appreciation Rate</strong>
      <p className="mt-1">Annual rate at which you expect this property's value to grow. Used in projection charts. Belgian residential real estate: ~3–4% in urban areas historically.</p>
    </>
  ),
  rent: (
    <>
      <strong className="text-white">Rent / Month</strong>
      <p className="mt-1">The gross monthly rental income (starting rent). In projections, this is indexed upward each year at the rent indexation rate.</p>
    </>
  ),
  rentIndex: (
    <>
      <strong className="text-white">Rent Indexation Rate</strong>
      <p className="mt-1">Annual rate at which rent is increased. In Belgium, residential rent is legally indexed to the health index (≈ 2% on average).</p>
    </>
  ),
  loanInterest: (
    <>
      <strong className="text-white">Loan Interest (monthly)</strong>
      <p className="mt-1">The interest portion of your monthly loan payments — this is the true cost of borrowing that flows out each month.</p>
      <p className="mt-1 text-slate-400">The capital repayment portion is not shown here — it reduces your debt and builds equity.</p>
    </>
  ),
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueColor = 'text-white', icon, trend, info }) {
  return (
    <div className="card flex items-start gap-4">
      {icon && (
        <div className="shrink-0 w-11 h-11 rounded-xl bg-slate-700/80 flex items-center justify-center text-brand-400">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="stat-label flex items-center">
          {label}
          {info && <InfoPopover>{info}</InfoPopover>}
        </p>
        <p className={`stat-value leading-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0
              ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            }
            {Math.abs(trend).toFixed(1)}% ROE
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Secondary metric card ────────────────────────────────────────────────────

function SecondaryMetric({ label, value, valueColor, sub, info }) {
  return (
    <div className="card text-center py-4">
      <p className="text-xs text-slate-400 mb-1 flex items-center justify-center">
        {label}
        {info && <InfoPopover>{info}</InfoPopover>}
      </p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  )
}

// ─── Property card ────────────────────────────────────────────────────────────

function PropertyCard({ property, onEdit, onDelete }) {
  const today = new Date()

  // Loan balance (amortization-aware)
  const currentLoanBalance = (property.loans || []).reduce((sum, l) => {
    if (l.amortizationSchedule?.length > 0) {
      const past = l.amortizationSchedule
        .filter((e) => new Date(e.dueDate) <= today)
        .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
      return sum + (past.length > 0 ? Math.max(0, past[0].remainingBalance) : l.originalAmount)
    }
    return sum + (l.originalAmount || 0)
  }, 0)

  const equity = property.currentValue - currentLoanBalance

  // Rental income — only if active today
  const rentalActive  = isRentalActiveOn(property, today)
  const monthlyIncome = rentalActive
    ? (property.startRentalIncome || property.monthlyRentalIncome || 0)
    : 0

  // Operating costs
  const monthlyOpex =
    (property.monthlyExpenses || 0) +
    ((property.annualMaintenanceCost || 0) + (property.annualInsuranceCost || 0)) / 12

  // Loan interest split
  const monthlyInterest = (property.loans || []).reduce((s, l) => {
    return s + getLoanPaymentSplit(l, today).monthlyInterest
  }, 0)

  // CF = rent - opex - interest (capital repayment excluded — builds equity)
  const monthlyCF = monthlyIncome - monthlyOpex - monthlyInterest

  const statusMeta    = getStatusMeta(property.status ?? (property.isRented ? 'rented' : 'owner_occupied'))
  const isHome        = isPrimaryResidenceOn(property, today)
  const monthlyIncomeFull = property.startRentalIncome || property.monthlyRentalIncome || 0

  // Days until rental starts (if future)
  const rentalStartsIn = (property.status === 'rented' && property.rentalStartDate && !rentalActive)
    ? Math.ceil((new Date(property.rentalStartDate) - today) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="card space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{property.name}</h3>
            {isHome && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                               bg-brand-900/50 border border-brand-700/50 text-brand-300">
                🏠 Home
              </span>
            )}
          </div>
          {property.address && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{property.address}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
          <button onClick={() => onEdit(property)}
            className="text-slate-400 hover:text-brand-400 transition-colors" title="Edit">
            <EditIcon />
          </button>
          <button onClick={() => onDelete(property.id)}
            className="text-slate-400 hover:text-red-400 transition-colors" title="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Future rental notice */}
      {rentalStartsIn !== null && (
        <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-2.5 py-1.5 text-xs text-amber-300">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Rental starts in <strong className="ml-0.5">{rentalStartsIn}d</strong>
          <span className="text-amber-500 ml-0.5">
            ({new Date(property.rentalStartDate).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })})
          </span>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Market Value"  value={formatEUR(property.currentValue)}   info={INFO.marketValue} />
        <Metric label="Equity"        value={formatEUR(equity)}
          color={equity >= 0 ? 'text-emerald-400' : 'text-red-400'}              info={INFO.equity} />
        <Metric label="Monthly CF"    value={formatEUR(monthlyCF)}
          color={monthlyCF >= 0 ? 'text-emerald-400' : 'text-red-400'}           info={INFO.monthlyCF} />
        <Metric label="Appreciation"  value={`${((property.appreciationRate || 0.02) * 100).toFixed(1)}% / yr`}
                                                                                  info={INFO.appreciation} />
        {monthlyIncomeFull > 0 && (
          <Metric
            label={rentalActive ? 'Rent / mo' : 'Future rent / mo'}
            value={formatEUR(monthlyIncomeFull)}
            color={rentalActive ? 'text-white' : 'text-slate-500'}
            info={INFO.rent}
          />
        )}
        {monthlyIncomeFull > 0 && (
          <Metric label="Rent index"  value={`${((property.indexationRate ?? 0.02) * 100).toFixed(1)}% / yr`}
            color="text-slate-300"                                                info={INFO.rentIndex} />
        )}
        {monthlyInterest > 0 && (
          <Metric label="Loan interest / mo" value={formatEUR(monthlyInterest)}
            color="text-red-400"                                                  info={INFO.loanInterest} />
        )}
      </div>

      {/* Loans */}
      {(property.loans || []).length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs font-medium text-slate-400 mb-2">
            Loans ({property.loans.length})
          </p>
          <div className="space-y-1.5">
            {property.loans.map((loan) => {
              const split = getLoanPaymentSplit(loan, today)
              return (
                <div key={loan.id} className="text-sm space-y-0.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-300 truncate">{loan.lender}</span>
                    <span className="text-slate-400 whitespace-nowrap shrink-0">
                      {formatEUR(loan.originalAmount)} @ {(loan.interestRate * 100).toFixed(2)}%
                      {loan.amortizationSchedule?.length > 0 && (
                        <span className="ml-1.5 text-[10px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded-full">
                          CSV
                        </span>
                      )}
                    </span>
                  </div>
                  {split.monthlyTotal > 0 && (
                    <div className="flex gap-3 text-[11px] text-slate-500 pl-0.5">
                      <span>Payment: <span className="text-slate-300">{formatEUR(split.monthlyTotal)}/mo</span></span>
                      <span>Interest: <span className="text-red-400">{formatEUR(split.monthlyInterest)}</span></span>
                      <span>Capital: <span className="text-emerald-400">{formatEUR(split.monthlyCapital)}</span></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, color = 'text-white', info }) {
  return (
    <div>
      <p className="text-xs text-slate-400 flex items-center">
        {label}
        {info && <InfoPopover>{info}</InfoPopover>}
      </p>
      <p className={`font-semibold text-sm ${color}`}>{value}</p>
    </div>
  )
}

// ─── Where I live banner ──────────────────────────────────────────────────────

function ResidenceBanner({ properties }) {
  const today = new Date()
  const home = properties.find((p) => isPrimaryResidenceOn(p, today))

  // Find upcoming move (residence starts in the future)
  const upcoming = properties
    .filter((p) => p.isPrimaryResidence && p.residenceStartDate && new Date(p.residenceStartDate) > today)
    .sort((a, b) => new Date(a.residenceStartDate) - new Date(b.residenceStartDate))[0]

  if (!home && !upcoming) return null

  return (
    <div className="flex flex-wrap gap-3">
      {home && (
        <div className="flex items-center gap-3 bg-brand-900/30 border border-brand-700/40
                        rounded-xl px-4 py-3 text-sm flex-1 min-w-0">
          <span className="text-xl shrink-0">🏠</span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-0.5">You currently live at</p>
            <p className="font-semibold text-brand-300 truncate">{home.name}</p>
            {home.address && <p className="text-xs text-slate-500 truncate">{home.address}</p>}
            {home.residenceEndDate && (
              <p className="text-xs text-amber-400 mt-0.5">
                Moving out: {new Date(home.residenceEndDate).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}
      {upcoming && (
        <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700
                        rounded-xl px-4 py-3 text-sm flex-1 min-w-0">
          <span className="text-xl shrink-0">📦</span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-0.5">Moving to</p>
            <p className="font-semibold text-white truncate">{upcoming.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(upcoming.residenceStartDate).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' '}({Math.ceil((new Date(upcoming.residenceStartDate) - today) / (1000 * 60 * 60 * 24))} days)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <p className="text-slate-300 font-medium">No properties yet</p>
      <p className="text-slate-500 text-sm mt-1 mb-4">Add your first property to get started</p>
      <button onClick={onAdd} className="btn-primary">
        <PlusIcon />
        Add Property
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard({ properties, onAddProperty, onEditProperty, onDeleteProperty }) {
  const s = computeSummary(properties)

  const ltv        = s.totalPortfolioValue > 0 ? (s.totalDebt / s.totalPortfolioValue) * 100 : null
  const grossYield = s.totalPortfolioValue > 0 ? (s.annualNetCashFlow / s.totalPortfolioValue) * 100 : null

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real estate portfolio overview</p>
        </div>
        <button onClick={onAddProperty} className="btn-primary">
          <PlusIcon />
          Add Property
        </button>
      </div>

      {/* ── Where I live banner ── */}
      {properties.length > 0 && <ResidenceBanner properties={properties} />}

      {/* ── Primary KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Portfolio Value"
          value={formatEUR(s.totalPortfolioValue)}
          sub={`${s.propertyCount} propert${s.propertyCount === 1 ? 'y' : 'ies'}`}
          icon={<BuildingIcon />}
          info={INFO.totalPortfolioValue}
        />
        <KpiCard
          label="Total Debt"
          value={formatEUR(s.totalDebt)}
          sub={`${s.loanCount} loan${s.loanCount === 1 ? '' : 's'}`}
          valueColor="text-red-400"
          icon={<DebtIcon />}
          info={INFO.totalDebt}
        />
        <KpiCard
          label="Net Worth"
          value={formatEUR(s.totalNetWorth)}
          valueColor={s.totalNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={<NetWorthIcon />}
          info={INFO.netWorth}
        />
        <KpiCard
          label="Net Cash Flow (Monthly)"
          value={formatEUR(s.totalMonthlyCashFlow)}
          valueColor={s.totalMonthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}
          sub={s.activeRentalCount === 0
            ? 'No active rentals — costs only'
            : `${s.activeRentalCount} active rental${s.activeRentalCount === 1 ? '' : 's'} · ${formatEUR(s.annualNetCashFlow)}/yr`}
          trend={s.roe}
          icon={<CashFlowIcon />}
          info={INFO.netCashFlow}
        />
      </div>

      {/* ── Loan interest/capital strip — only when there are loans ── */}
      {s.loanCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5 flex items-center justify-center">
              Loan Interest / mo
              <InfoPopover>{INFO.loanInterest}</InfoPopover>
            </p>
            <p className="text-lg font-bold text-red-400">{formatEUR(s.monthlyInterest)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">true cost — leaves your pocket</p>
          </div>
          <div className="card py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Capital Repayment / mo</p>
            <p className="text-lg font-bold text-emerald-400">{formatEUR(s.monthlyCapital)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">equity building — yours to keep</p>
          </div>
          <div className="card py-3 text-center">
            <p className="text-xs text-slate-400 mb-0.5">Total Loan Payment / mo</p>
            <p className="text-lg font-bold text-white">{formatEUR(s.monthlyInterest + s.monthlyCapital)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {s.monthlyInterest + s.monthlyCapital > 0
                ? `${Math.round(s.monthlyInterest / (s.monthlyInterest + s.monthlyCapital) * 100)}% interest · ${Math.round(s.monthlyCapital / (s.monthlyInterest + s.monthlyCapital) * 100)}% capital`
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── Secondary metrics strip ── */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SecondaryMetric
            label="Loan-to-Value (LTV)"
            value={ltv !== null ? `${ltv.toFixed(1)}%` : '—'}
            valueColor={
              ltv === null ? 'text-slate-400'
              : ltv > 80   ? 'text-red-400'
              : ltv > 60   ? 'text-orange-400'
              : 'text-emerald-400'
            }
            sub="debt / portfolio value"
            info={INFO.ltv}
          />
          <SecondaryMetric
            label="Return on Equity (ROE)"
            value={s.totalNetWorth > 0 ? `${s.roe.toFixed(1)}%` : '—'}
            valueColor={s.roe >= 0 ? 'text-emerald-400' : 'text-red-400'}
            sub="annual net CF / equity"
            info={INFO.roeSecondary}
          />
          <SecondaryMetric
            label="Net Yield"
            value={grossYield !== null ? `${grossYield.toFixed(1)}%` : '—'}
            valueColor={
              grossYield === null ? 'text-slate-400'
              : grossYield >= 0   ? 'text-brand-400'
              : 'text-red-400'
            }
            sub="annual net CF / portfolio value"
            info={INFO.netYield}
          />
        </div>
      )}

      {/* ── Property cards ── */}
      <div>
        <h2 className="section-title">Properties</h2>
        {properties.length === 0 ? (
          <EmptyState onAdd={onAddProperty} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p}
                onEdit={onEditProperty} onDelete={onDeleteProperty} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function DebtIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  )
}

function NetWorthIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CashFlowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
