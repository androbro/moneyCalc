-- ============================================================
-- MoneyCalc — Phase 8b migration
-- Add members JSONB column to household_profile
-- Run in the Supabase SQL Editor
-- ============================================================

-- Add a members column that stores an array of household member objects.
-- Each element:
--   { id, name, netIncome, investmentIncome, cash }
-- Default is an empty array so existing rows are untouched.
alter table household_profile
  add column if not exists members jsonb not null default '[]'::jsonb;
