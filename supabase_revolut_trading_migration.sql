-- ─── Revolut Trading Account: trade history ──────────────────────────────────
--
-- Each row is one line from the Revolut trading CSV export.
-- Supported types: CASH TOP-UP, BUY - LIMIT, BUY - MARKET, SELL - MARKET,
--                  SELL - LIMIT, DIVIDEND
--
-- Amounts are stored in the original trade currency (e.g. EUR or USD).
-- The fx_rate column converts back to EUR when currency != EUR.
-- The eur_amount computed column gives the EUR-equivalent of total_amount.

create table if not exists revolut_trades (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users(id) on delete cascade,

  -- Raw CSV columns
  traded_at         timestamptz not null,          -- "Date" column (ISO 8601)
  ticker            text,                          -- e.g. "EXI2", "RHM", null for CASH TOP-UP
  type              text        not null,          -- "CASH TOP-UP", "BUY - MARKET", "DIVIDEND", …
  quantity          numeric,                       -- null for CASH TOP-UP / DIVIDEND
  price_per_share   numeric,                       -- null for CASH TOP-UP / DIVIDEND
  total_amount      numeric     not null,          -- absolute value (always positive)
  currency          text        not null default 'EUR',
  fx_rate           numeric     not null default 1,

  -- Metadata
  created_at        timestamptz not null default now(),

  -- Prevent exact duplicate imports
  unique (user_id, traded_at, ticker, type, total_amount, currency)
);

-- Index for fast per-user queries ordered by date
create index if not exists revolut_trades_user_date
  on revolut_trades (user_id, traded_at desc);

-- Index for per-ticker lookups
create index if not exists revolut_trades_ticker
  on revolut_trades (user_id, ticker)
  where ticker is not null;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table revolut_trades enable row level security;

-- Authenticated users can only see their own rows
create policy "Users see own trades"
  on revolut_trades for select
  using (auth.uid() = user_id);

create policy "Users insert own trades"
  on revolut_trades for insert
  with check (auth.uid() = user_id);

create policy "Users delete own trades"
  on revolut_trades for delete
  using (auth.uid() = user_id);
