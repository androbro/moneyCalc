-- ============================================================
-- MoneyCalc — Vacancy rate migration
-- Adds vacancy_rate field to account for expected vacancy periods
-- Run in the Supabase SQL Editor
-- ============================================================

-- Vacancy rate — expected percentage of time property is vacant (0.00 to 1.00)
-- Default: 0.05 (5% vacancy) for rental properties
-- NULL or 0 = no vacancy adjustment
-- Used to reduce projected rental income: effectiveRent = grossRent × (1 - vacancyRate)
alter table properties
  add column if not exists vacancy_rate numeric(5,4) default 0.05
    check (vacancy_rate >= 0 and vacancy_rate <= 1);

comment on column properties.vacancy_rate is 
  'Expected vacancy rate (0.00-1.00). Reduces rental income in projections. Default 5% for realistic modeling.';
