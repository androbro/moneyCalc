-- Migration: add acquisition cost columns to properties table
-- Run this in the Supabase SQL Editor once.
--
-- All columns are nullable. NULL means "not entered — use the Belgian estimate".
-- Zero (0) is a valid explicit entry meaning the cost was genuinely zero.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS registration_tax        NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notary_fees             NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agency_fees             NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS other_acquisition_costs NUMERIC DEFAULT NULL;
