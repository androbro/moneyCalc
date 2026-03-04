-- ─── Phase 9: Property Simulator persistence ─────────────────────────────────
--
-- Stores the simulator state as a single JSONB blob under id = 'default'.
-- We intentionally use JSONB (not columns) so adding new simulator fields
-- never requires another migration — the app just reads/writes the full object.
--
-- Run this in the Supabase SQL editor.

create table if not exists simulator_profile (
  id         text primary key default 'default',
  state      jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed the single row so upserts always have a target
insert into simulator_profile (id, state)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- Auto-update updated_at on every write
create or replace function update_simulator_profile_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists simulator_profile_updated_at on simulator_profile;
create trigger simulator_profile_updated_at
  before update on simulator_profile
  for each row execute function update_simulator_profile_updated_at();

-- RLS: open policy (no auth yet, same as household_profile)
alter table simulator_profile enable row level security;

drop policy if exists allow_all_simulator on simulator_profile;
create policy allow_all_simulator
  on simulator_profile for all
  using (true)
  with check (true);
