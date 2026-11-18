-- ============================================================
-- Trip registration + trip costs
--
-- People sign up for the TRIP, not for its rounds. A sign-up lands in
-- trip_registrations (pending); the admin confirms it, which adds a
-- trip_travelers row. Round rosters are never touched (travelers and
-- event_players stay deliberately separate).
--
-- Trip costs live on trips.cost_items (jsonb array). Each item:
--   { id, label, kind: 'lodging'|'golf'|'other', event_id (golf only),
--     mode: 'per_person'|'split', amount, split_count (null = planned headcount) }
-- A 'split' item is divided by its split_count, else trips.planned_headcount,
-- so the price a registrant sees is fixed and doesn't move as others sign up.
-- ============================================================

alter table public.trips
  add column if not exists registration_open  boolean not null default false,
  add column if not exists registration_spots int,
  add column if not exists planned_headcount  int,
  add column if not exists cost_items         jsonb not null default '[]'::jsonb,
  add column if not exists venmo_handle       text,
  add column if not exists paypal_link        text,
  add column if not exists zelle_handle       text,
  add column if not exists custom_questions   jsonb not null default '[]'::jsonb;

create table if not exists public.trip_registrations (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  first_name    text not null check (btrim(first_name) <> ''),
  last_name     text not null check (btrim(last_name) <> ''),
  email         text,
  phone         text,
  golfing       boolean not null default true,
  -- Rounds (events of the trip's league) this person plans to play.
  round_ids     uuid[] not null default '{}',
  answers       jsonb not null default '[]'::jsonb, -- [{ label, answer }]
  notes         text,
  quoted_total  numeric(10,2),                      -- the total shown when they registered
  status        text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  traveler_id   uuid references public.trip_travelers(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_trip_registrations_trip_id on public.trip_registrations (trip_id);

alter table public.trip_registrations enable row level security;

-- Anyone may sign up while the trip is taking registrations.
create policy "Public insert trip registrations" on public.trip_registrations for insert with check (
  exists (select 1 from public.trips t where t.id = trip_registrations.trip_id and t.registration_open)
);
-- Only the trip's org admins can see or manage sign-ups (they hold contact details).
create policy "Org admin read trip registrations" on public.trip_registrations for select using (
  public.is_admin() and org_id = public.get_my_org_id()
);
create policy "Org admin update trip registrations" on public.trip_registrations for update using (
  public.is_admin() and org_id = public.get_my_org_id()
) with check (
  public.is_admin() and org_id = public.get_my_org_id()
);
create policy "Org admin delete trip registrations" on public.trip_registrations for delete using (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- On insert: take org_id from the trip (never from the client), start every sign-up as
-- pending and unlinked, keep only rounds that belong to this trip, and rate-limit floods.
create or replace function public.prepare_trip_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league uuid;
begin
  if not public.check_rate_limit('trip-register:' || new.trip_id::text, 30, 60) then
    raise exception 'Too many sign-ups submitted for this trip. Please wait a moment and try again.';
  end if;

  select t.org_id, t.league_id into new.org_id, v_league from public.trips t where t.id = new.trip_id;
  new.status      := 'pending';
  new.traveler_id := null;
  new.round_ids   := coalesce(array(
    select e.id from public.events e
    where e.league_id = v_league and e.id = any(coalesce(new.round_ids, '{}'))
  ), '{}');
  if not new.golfing then new.round_ids := '{}'; end if;
  return new;
end;
$$;

drop trigger if exists trip_registrations_prepare on public.trip_registrations;
create trigger trip_registrations_prepare
  before insert on public.trip_registrations
  for each row execute function public.prepare_trip_registration();

-- A trip's rounds never take their own registrations: sign-up happens on the trip.
drop policy if exists "Public insert registrations" on public.registrations;
create policy "Public insert registrations" on public.registrations for insert with check (
  exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = registrations.event_id
      and e.registration_open
      and e.status = 'upcoming'
      and not l.is_trip_league
  )
);

comment on table public.trip_registrations is
  'Public sign-ups for a trip. Confirming one creates a trip_travelers row (traveler_id); round rosters are never changed.';
comment on column public.trips.cost_items is
  'Trip cost items: [{ id, label, kind lodging|golf|other, event_id, mode per_person|split, amount, split_count }]. Split items divide by split_count, else planned_headcount.';
