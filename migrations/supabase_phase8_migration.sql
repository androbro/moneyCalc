-- ============================================================
-- MoneyCalc — Phase 8 migration
-- Household Financial Planner + AI Insights
-- Run in the Supabase SQL Editor after supabase_schema.sql
-- ============================================================

-- ── household_profile ────────────────────────────────────────
-- Single-row table (id = 'default') that stores the household
-- financial profile used by the Cash-Flow Aggregator and AI
-- Insights panel.
--
-- Income fields (all monthly net, in EUR):
--   my_net_income          – your net monthly salary
--   my_investment_income   – net monthly income from stocks/trading
--   partner_net_income     – partner's net monthly salary
--   partner_cash           – partner's lump-sum cash available now
--
-- Savings & cost fields (monthly, EUR):
--   household_expenses     – joint living costs (rent, food, utilities…)
--   personal_savings_rate  – fraction of total income saved each month
--                            (e.g. 0.15 = 15%); used to reduce free cash
--
-- Down-payment target:
--   target_down_payment    – cash you want to accumulate for next purchase
--   target_purchase_year   – calendar year you aim to buy the next property
--
-- New-residence loan (to be bought with the partner):
--   new_residence_price         – agreed purchase price of new primary home
--   new_residence_loan_amount   – loan share you and partner will take
--   new_residence_monthly_payment – estimated monthly repayment
--   new_residence_purchase_date  – planned purchase/settlement date
create table if not exists household_profile (
  id                            text primary key default 'default',
  -- income
  my_net_income                 numeric(12,2) default 0,
  my_investment_income          numeric(12,2) default 0,
  partner_net_income            numeric(12,2) default 0,
  partner_cash                  numeric(14,2) default 0,
  -- costs & savings
  household_expenses            numeric(12,2) default 0,
  personal_savings_rate         numeric(6,4)  default 0.10,
  -- acquisition target
  target_down_payment           numeric(14,2) default 0,
  target_purchase_year          integer,
  -- new primary residence (joint with partner)
  new_residence_price           numeric(14,2) default 0,
  new_residence_loan_amount     numeric(14,2) default 0,
  new_residence_monthly_payment numeric(10,2) default 0,
  new_residence_purchase_date   date,
  -- meta
  created_at                    timestamptz default now(),
  updated_at                    timestamptz default now()
);

create trigger trg_household_profile_updated_at
  before update on household_profile
  for each row execute procedure set_updated_at();

alter table household_profile enable row level security;
create policy "allow_all_household_profile"
  on household_profile for all using (true) with check (true);

-- ── Seed the single default row so upsert always has a target ──
insert into household_profile (id) values ('default')
  on conflict (id) do nothing;
