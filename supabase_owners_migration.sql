-- ============================================================
-- MoneyCalc — Property owners migration
-- Adds an owners JSONB column to properties table
-- Each element: { name: string, share: number (0–1) }
-- Example: [{ name: "Me", share: 1.0 }]
--          [{ name: "Me", share: 0.5 }, { name: "Sarah", share: 0.5 }]
-- Run in the Supabase SQL Editor
-- ============================================================

alter table properties
  add column if not exists owners jsonb not null default '[{"name":"Me","share":1}]'::jsonb;
