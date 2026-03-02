-- ============================================================
-- MoneyCalc — Share tokens migration
-- Creates the share_tokens table that powers public read-only
-- portfolio sharing links with per-group permission toggles.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ── 1. Create share_tokens table ─────────────────────────────────────────────

create table if not exists share_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  permissions jsonb not null default '{"dashboard":true,"properties":true,"financials":true,"household":false}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Index for fast token lookups (the public read path)
create index if not exists share_tokens_token_idx on share_tokens(token);

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

alter table share_tokens enable row level security;

-- Owner can read their own tokens (to show the share modal)
create policy "share_tokens_owner_select"
  on share_tokens for select
  using (user_id = auth.uid());

-- Owner can insert (generate a new share link)
create policy "share_tokens_owner_insert"
  on share_tokens for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Owner can update permissions on their own token
create policy "share_tokens_owner_update"
  on share_tokens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Owner can revoke (delete) their own token
create policy "share_tokens_owner_delete"
  on share_tokens for delete
  using (user_id = auth.uid());

-- ── 3. Public token-lookup function ──────────────────────────────────────────
--
-- Anonymous (unauthenticated) users cannot SELECT from share_tokens directly
-- because they have no matching user_id = auth.uid() policy. We use a
-- SECURITY DEFINER function to do the lookup safely — it returns only the
-- user_id + permissions for a valid token, nothing else.

create or replace function resolve_share_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec share_tokens%rowtype;
begin
  select * into rec
  from share_tokens
  where token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id',     rec.user_id,
    'permissions', rec.permissions
  );
end;
$$;

-- Grant execute to all roles (including anonymous)
grant execute on function resolve_share_token(text) to anon, authenticated;

-- ── 4. Public data-fetch function ────────────────────────────────────────────
--
-- Fetches the portfolio data for the owner of a share token.
-- Returns a single JSON blob with properties (+ loans + amortization +
-- planned_investments) and household_profile.
-- Also SECURITY DEFINER so it can bypass RLS and read the owner's rows
-- on behalf of an anonymous viewer.

create or replace function get_shared_portfolio(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid;
  v_permissions jsonb;
  v_properties  jsonb;
  v_household   jsonb;
begin
  -- Resolve token → user_id + permissions
  select user_id, permissions
  into v_user_id, v_permissions
  from share_tokens
  where token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  -- Fetch properties with nested loans, amortization schedules, planned investments
  select coalesce(jsonb_agg(p_full order by p_full->>'name'), '[]'::jsonb)
  into v_properties
  from (
    select
      to_jsonb(p) ||
      jsonb_build_object(
        'loans', (
          select coalesce(jsonb_agg(
            to_jsonb(l) ||
            jsonb_build_object(
              'amortization_schedule', (
                select coalesce(jsonb_agg(a order by a.month), '[]'::jsonb)
                from amortization_schedules a
                where a.loan_id = l.id
              )
            )
          ), '[]'::jsonb)
          from loans l
          where l.property_id = p.id
        ),
        'planned_investments', (
          select coalesce(jsonb_agg(pi order by pi.target_year), '[]'::jsonb)
          from planned_investments pi
          where pi.property_id = p.id
        )
      ) as p_full
    from properties p
    where p.user_id = v_user_id
  ) sub;

  -- Fetch household profile
  select to_jsonb(h)
  into v_household
  from household_profile h
  where h.user_id = v_user_id
  limit 1;

  return jsonb_build_object(
    'user_id',     v_user_id,
    'permissions', v_permissions,
    'properties',  v_properties,
    'household',   v_household
  );
end;
$$;

grant execute on function get_shared_portfolio(text) to anon, authenticated;
