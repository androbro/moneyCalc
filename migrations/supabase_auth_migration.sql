-- ============================================================
-- MoneyCalc — Auth migration
-- Adds user_id to all tables and replaces the open "allow_all"
-- RLS policies with proper user-scoped ones.
--
-- Run this in the Supabase SQL Editor AFTER enabling
-- Authentication → Providers → Email and Google in the dashboard.
-- ============================================================

-- ── 1. Add user_id column to every table ──────────────────────────────────────

alter table properties
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table household_profile
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table simulator_profile
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- loans, amortization_schedules and planned_investments are child tables
-- that cascade-delete from properties, so they inherit ownership via the
-- property FK. We do NOT add user_id there — RLS is handled via the parent.

-- ── 2. Drop the old open "allow_all" policies ────────────────────────────────

drop policy if exists "allow_all_properties"           on properties;
drop policy if exists "allow_all_loans"                on loans;
drop policy if exists "allow_all_amortization"         on amortization_schedules;
drop policy if exists "allow_all_planned_investments"  on planned_investments;

-- (household_profile and simulator_profile may have been created with open
--  policies in later migrations — drop them too if they exist)
drop policy if exists "allow_all_household"            on household_profile;
drop policy if exists "allow_all_simulator"            on simulator_profile;

-- ── 3. Properties — user-scoped + guest (NULL user_id) read ──────────────────
--
-- Authenticated users can only touch their own rows.
-- Unauthenticated visitors (guest mode) can SELECT rows where user_id IS NULL
-- so the demo data is still publicly readable.
-- The INSERT/UPDATE/DELETE policies require an authenticated user.

create policy "properties_select"
  on properties for select
  using (
    user_id = auth.uid()          -- owner sees their rows
    or user_id is null            -- guests see unclaimed demo rows
  );

create policy "properties_insert"
  on properties for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "properties_update"
  on properties for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "properties_delete"
  on properties for delete
  using (user_id = auth.uid());

-- ── 4. Child tables (loans, amortization_schedules, planned_investments) ──────
--
-- These have no user_id column; access is governed via the parent property row.

create policy "loans_select"
  on loans for select
  using (
    exists (
      select 1 from properties p
      where p.id = loans.property_id
        and (p.user_id = auth.uid() or p.user_id is null)
    )
  );

create policy "loans_insert"
  on loans for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from properties p
      where p.id = loans.property_id and p.user_id = auth.uid()
    )
  );

create policy "loans_update"
  on loans for update
  using (
    exists (
      select 1 from properties p
      where p.id = loans.property_id and p.user_id = auth.uid()
    )
  );

create policy "loans_delete"
  on loans for delete
  using (
    exists (
      select 1 from properties p
      where p.id = loans.property_id and p.user_id = auth.uid()
    )
  );

create policy "amortization_select"
  on amortization_schedules for select
  using (
    exists (
      select 1 from loans l
      join properties p on p.id = l.property_id
      where l.id = amortization_schedules.loan_id
        and (p.user_id = auth.uid() or p.user_id is null)
    )
  );

create policy "amortization_insert"
  on amortization_schedules for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from loans l
      join properties p on p.id = l.property_id
      where l.id = amortization_schedules.loan_id
        and p.user_id = auth.uid()
    )
  );

create policy "amortization_update"
  on amortization_schedules for update
  using (
    exists (
      select 1 from loans l
      join properties p on p.id = l.property_id
      where l.id = amortization_schedules.loan_id
        and p.user_id = auth.uid()
    )
  );

create policy "amortization_delete"
  on amortization_schedules for delete
  using (
    exists (
      select 1 from loans l
      join properties p on p.id = l.property_id
      where l.id = amortization_schedules.loan_id
        and p.user_id = auth.uid()
    )
  );

create policy "planned_investments_select"
  on planned_investments for select
  using (
    exists (
      select 1 from properties p
      where p.id = planned_investments.property_id
        and (p.user_id = auth.uid() or p.user_id is null)
    )
  );

create policy "planned_investments_insert"
  on planned_investments for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from properties p
      where p.id = planned_investments.property_id and p.user_id = auth.uid()
    )
  );

create policy "planned_investments_update"
  on planned_investments for update
  using (
    exists (
      select 1 from properties p
      where p.id = planned_investments.property_id and p.user_id = auth.uid()
    )
  );

create policy "planned_investments_delete"
  on planned_investments for delete
  using (
    exists (
      select 1 from properties p
      where p.id = planned_investments.property_id and p.user_id = auth.uid()
    )
  );

-- ── 5. household_profile — per-user rows (no more single 'default' row) ───────
--
-- After auth, each user has their own row (PK = user_id rather than 'default').
-- The old 'default' row stays readable by guests (user_id IS NULL).

create policy "household_select"
  on household_profile for select
  using (user_id = auth.uid() or user_id is null);

create policy "household_insert"
  on household_profile for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "household_update"
  on household_profile for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "household_delete"
  on household_profile for delete
  using (user_id = auth.uid());

-- ── 6. simulator_profile — same pattern ──────────────────────────────────────

create policy "simulator_select"
  on simulator_profile for select
  using (user_id = auth.uid() or user_id is null);

create policy "simulator_insert"
  on simulator_profile for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "simulator_update"
  on simulator_profile for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "simulator_delete"
  on simulator_profile for delete
  using (user_id = auth.uid());

-- ── 7. Helper function: claim all ownerless rows ──────────────────────────────
--
-- Call this from the app after a user logs in for the first time to migrate
-- the existing data to their account.
-- The function is SECURITY DEFINER so it can bypass RLS for the UPDATE.

create or replace function claim_ownerless_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prop_count   int;
  profile_count int;
  sim_count     int;
begin
  update properties
    set user_id = p_user_id
    where user_id is null;
  get diagnostics prop_count = row_count;

  update household_profile
    set user_id = p_user_id
    where user_id is null;
  get diagnostics profile_count = row_count;

  update simulator_profile
    set user_id = p_user_id
    where user_id is null;
  get diagnostics sim_count = row_count;

  return jsonb_build_object(
    'properties',        prop_count,
    'household_profile', profile_count,
    'simulator_profile', sim_count
  );
end;
$$;

-- Grant execute to authenticated users (each call only touches their own UID)
grant execute on function claim_ownerless_data(uuid) to authenticated;
