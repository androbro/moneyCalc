-- Migration: add valuation_date column to properties table
-- Run this in the Supabase SQL Editor once.
--
-- valuation_date: the date the current_value estimate was made.
-- Used by the ProjectionChart and PropertyDetail to project value forward
-- from the correct anchor date instead of always assuming "today".

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS valuation_date DATE DEFAULT NULL;
