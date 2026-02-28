-- ============================================================
-- MoneyCalc — Property lifecycle migration
-- Adds status, rental period, and primary-residence tracking
-- Run in the Supabase SQL Editor
-- ============================================================

-- Property status enum
-- Values: 'owner_occupied' | 'rented' | 'vacant' | 'for_sale' | 'renovation'
alter table properties
  add column if not exists status text not null default 'rented';

-- Rental period — when rental income actually starts/ends
-- NULL rental_start_date = rental started before tracking (use isRented flag)
-- NULL rental_end_date   = open-ended (ongoing rental)
alter table properties
  add column if not exists rental_start_date date;

alter table properties
  add column if not exists rental_end_date date;

-- Primary residence tracking — marks this property as where you live
-- for a given date range. Multiple historical ranges are not modelled here;
-- just the current/most-recent period.
alter table properties
  add column if not exists is_primary_residence boolean not null default false;

alter table properties
  add column if not exists residence_start_date date;

alter table properties
  add column if not exists residence_end_date date;
