-- ============================================================
-- MoneyCalc — Supabase schema
-- Run this once in the Supabase SQL Editor:
-- https://mrnlejvurnqiywjegnpd.supabase.co/project/default/sql
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── properties ──────────────────────────────────────────────
create table if not exists properties (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  address               text,
  purchase_price        numeric(14,2) default 0,
  current_value         numeric(14,2) not null default 0,
  appreciation_rate     numeric(6,4)  default 0.02,
  purchase_date         date,
  -- rental income
  start_rental_income   numeric(10,2) default 0,
  indexation_rate       numeric(6,4)  default 0.02,
  -- operating costs
  monthly_expenses      numeric(10,2) default 0,
  annual_maintenance_cost numeric(10,2) default 0,
  annual_insurance_cost   numeric(10,2) default 0,
  annual_property_tax     numeric(10,2) default 0,
  inflation_rate          numeric(6,4)  default 0.02,
  -- meta
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── loans ────────────────────────────────────────────────────
create table if not exists loans (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references properties(id) on delete cascade,
  lender           text,
  original_amount  numeric(14,2) default 0,
  interest_rate    numeric(6,4)  default 0,
  start_date       date,
  term_months      integer       default 0,
  monthly_payment  numeric(10,2) default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── amortization_schedules ───────────────────────────────────
create table if not exists amortization_schedules (
  id                uuid primary key default gen_random_uuid(),
  loan_id           uuid not null references loans(id) on delete cascade,
  period            integer not null,
  due_date          date,
  capital_repayment numeric(12,2) default 0,
  interest          numeric(12,2) default 0,
  total_payment     numeric(12,2) default 0,
  remaining_balance numeric(14,2) default 0
);

-- index for fast lookups by loan + date
create index if not exists idx_amort_loan_date on amortization_schedules(loan_id, due_date);

-- ── updated_at trigger ───────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_properties_updated_at
  before update on properties
  for each row execute procedure set_updated_at();

create trigger trg_loans_updated_at
  before update on loans
  for each row execute procedure set_updated_at();

-- ── Row Level Security (enable but allow all for now — add auth later) ──
alter table properties          enable row level security;
alter table loans               enable row level security;
alter table amortization_schedules enable row level security;

-- Temporary open policies (replace with user-scoped policies when you add auth)
create policy "allow_all_properties"           on properties           for all using (true) with check (true);
create policy "allow_all_loans"                on loans                for all using (true) with check (true);
create policy "allow_all_amortization"         on amortization_schedules for all using (true) with check (true);
