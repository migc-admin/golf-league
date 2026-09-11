-- ============================================================
-- Golf Trips — Phase 1
-- A Trip is a dedicated `leagues` row (hidden from normal league
-- UI/nav) with trip-specific metadata layered on via `trips`.
-- Trip "rounds" are just that league's `events` rows — no changes
-- needed to events/event_players/scores/side_games/skins/payouts.
-- ============================================================

-- ── 1. Flag to hide a league's dedicated-trip container from
--      normal league listings/nav. ──────────────────────────────
alter table public.leagues
  add column if not exists is_trip_league boolean not null default false;

create index if not exists idx_leagues_is_trip_league
  on public.leagues (org_id)
  where is_trip_league = true;

-- ── 2. Trips table — 1:1 with a dedicated `leagues` row. ────────
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null unique references public.leagues(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  slug          text not null,
  description   text,
  start_date    date,
  end_date      date,
  location      text,
  logo_url      text,
  display_order int,
  created_at    timestamptz not null default now()
);

create unique index if not exists trips_slug_unique on public.trips (slug);
create index if not exists idx_trips_org_id on public.trips (org_id);

alter table public.trips enable row level security;

-- Mirrors the `leagues` RLS pattern exactly (direct org_id column,
-- no join needed).
create policy "Read trips" on public.trips for select using (
  auth.role() = 'anon'
  or org_id = public.get_my_org_id()
);
create policy "Admin write trips" on public.trips for all using (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- ── 3. Atomic "create trip" RPC ──────────────────────────────────
-- Generates the underlying league's slug explicitly here (rather
-- than relying on any slug-generation trigger that may or may not
-- exist on `leagues` in the live DB) so this net-new code path
-- carries zero risk to existing league-creation behavior.
create or replace function public.create_trip(
  p_org_id      uuid,
  p_name        text,
  p_description text default null,
  p_start_date  date default null,
  p_end_date    date default null,
  p_location    text default null,
  p_logo_url    text default null
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league  public.leagues;
  v_trip    public.trips;
  v_base    text;
  v_slug    text;
  v_counter int := 1;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_org_id is distinct from public.get_my_org_id() then
    raise exception 'Not authorized for this organization';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Trip name is required';
  end if;

  v_base := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'trip'; end if;
  v_slug := v_base;

  while exists (select 1 from public.leagues where slug = v_slug)
     or exists (select 1 from public.trips where slug = v_slug) loop
    v_counter := v_counter + 1;
    v_slug    := v_base || '-' || v_counter;
  end loop;

  insert into public.leagues (name, season_year, org_id, slug, is_trip_league)
  values (
    trim(p_name),
    extract(year from coalesce(p_start_date, now()))::int,
    p_org_id,
    v_slug,
    true
  )
  returning * into v_league;

  insert into public.trips (
    league_id, org_id, name, slug, description, start_date, end_date, location, logo_url
  )
  values (
    v_league.id, p_org_id, trim(p_name), v_slug,
    p_description, p_start_date, p_end_date, p_location, p_logo_url
  )
  returning * into v_trip;

  return v_trip;
end;
$$;

grant execute on function public.create_trip(uuid, text, text, date, date, text, text) to authenticated;

comment on table public.trips is
  'Trip-specific metadata layered on top of a dedicated (hidden) leagues row. Trip "rounds" are that league''s events rows. Deleting the leagues row (leagues.id = trips.league_id) cascades and deletes the trip.';
