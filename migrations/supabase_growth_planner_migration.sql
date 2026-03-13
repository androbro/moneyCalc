-- ============================================================
-- MoneyCalc — Growth Planner persistence + sharing
-- Persists planned acquisitions and includes them in share links.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ── 1. Growth planner profile table ─────────────────────────────────────────
create table if not exists growth_planner_profile (
  id            text primary key default 'default',
  user_id       uuid references auth.users(id) on delete cascade,
  acquisitions  jsonb not null default '[]'::jsonb,
  horizon_years integer not null default 25,
  max_ltv       numeric(6,4) not null default 0.80,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists growth_planner_profile_user_id_uniq
  on growth_planner_profile(user_id)
  where user_id is not null;

drop trigger if exists trg_growth_planner_profile_updated_at on growth_planner_profile;

create trigger trg_growth_planner_profile_updated_at
  before update on growth_planner_profile
  for each row execute procedure set_updated_at();

alter table growth_planner_profile enable row level security;

drop policy if exists "growth_planner_select" on growth_planner_profile;
drop policy if exists "growth_planner_insert" on growth_planner_profile;
drop policy if exists "growth_planner_update" on growth_planner_profile;
drop policy if exists "growth_planner_delete" on growth_planner_profile;

create policy "growth_planner_select"
  on growth_planner_profile for select
  using (user_id = auth.uid() or user_id is null);

create policy "growth_planner_insert"
  on growth_planner_profile for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "growth_planner_update"
  on growth_planner_profile for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "growth_planner_delete"
  on growth_planner_profile for delete
  using (user_id = auth.uid());

-- Optional guest fallback row (user_id null). Authenticated users use id = auth.uid().
insert into growth_planner_profile (id)
values ('default')
on conflict (id) do nothing;

-- ── 2. Public share RPC now includes growth planner state ───────────────────
create or replace function get_shared_portfolio(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id         uuid;
  v_permissions     jsonb;
  v_properties      jsonb;
  v_household       jsonb;
  v_growth_planner  jsonb;
begin
  select user_id, permissions
  into v_user_id, v_permissions
  from share_tokens
  where token = p_token
  limit 1;

  if not found then
    return null;
  end if;

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
                select coalesce(jsonb_agg(a order by a.period), '[]'::jsonb)
                from amortization_schedules a
                where a.loan_id = l.id
              )
            )
          ), '[]'::jsonb)
          from loans l
          where l.property_id = p.id
        ),
        'planned_investments', (
          select coalesce(jsonb_agg(pi order by pi.planned_date), '[]'::jsonb)
          from planned_investments pi
          where pi.property_id = p.id
        )
      ) as p_full
    from properties p
    where p.user_id = v_user_id
  ) sub;

  select to_jsonb(h)
  into v_household
  from household_profile h
  where h.user_id = v_user_id
  limit 1;

  select to_jsonb(g)
  into v_growth_planner
  from growth_planner_profile g
  where g.user_id = v_user_id
  limit 1;

  return jsonb_build_object(
    'user_id',         v_user_id,
    'permissions',     v_permissions,
    'properties',      v_properties,
    'household',       v_household,
    'growth_planner',  coalesce(v_growth_planner, '{}'::jsonb)
  );
end;
$$;

grant execute on function get_shared_portfolio(text) to anon, authenticated;
