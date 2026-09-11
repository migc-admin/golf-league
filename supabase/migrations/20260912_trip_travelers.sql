-- ============================================================
-- Trip Travelers + Rooming
-- Who is going on the trip, and who is rooming with whom.
--
-- Deliberately independent of `event_players`: a traveler is not
-- necessarily playing golf (spouses, non-golfer friends), and
-- adding a traveler must never mutate a round roster that may
-- already have scores entered.
--
-- Rooming mirrors the pairings model on `event_players`
-- (group_number / group_order) so the admin drag-and-drop UI
-- behaves identically: room_number is the room, room_order is the
-- position within it. A null room_number means "unassigned".
-- ============================================================

create table public.trip_travelers (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  -- Exactly one of player_id / guest_name identifies the traveler.
  player_id    uuid references public.players(id) on delete cascade,
  guest_name   text,
  room_number  int,
  room_order   int,
  notes        text,
  created_at   timestamptz not null default now(),

  constraint trip_travelers_identity_check check (
    (player_id is not null and guest_name is null)
    or (player_id is null and guest_name is not null and btrim(guest_name) <> '')
  )
);

-- A roster player can only appear once per trip. Guests are unconstrained
-- (two people may legitimately share a name), so this is a partial index.
create unique index trip_travelers_trip_player_key
  on public.trip_travelers (trip_id, player_id)
  where player_id is not null;

create index idx_trip_travelers_trip_id on public.trip_travelers (trip_id);
create index idx_trip_travelers_org_id  on public.trip_travelers (org_id);

alter table public.trip_travelers enable row level security;

-- Mirrors the `trips` RLS pattern exactly (direct org_id column).
create policy "Read trip travelers" on public.trip_travelers for select using (
  auth.role() = 'anon'
  or org_id = public.get_my_org_id()
);
create policy "Admin write trip travelers" on public.trip_travelers for all using (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- Optional display names for rooms, keyed by room_number as a string:
-- { "1": "Villa A — Master", "3": "Pool House" }. Rooms without an entry
-- fall back to "Room N". Kept on `trips` rather than a rooms table because
-- a room has no other attributes and only exists implicitly via assignments.
alter table public.trips
  add column if not exists room_labels jsonb not null default '{}'::jsonb;

comment on column public.trips.room_labels is
  'Optional room display names keyed by room number as text, e.g. { "1": "Villa A - Master" }. Missing keys render as "Room N".';

comment on table public.trip_travelers is
  'Trip roster. Each row is one traveler — either a linked players row (player_id) or a name-only guest (guest_name). room_number/room_order hold the rooming assignment, mirroring event_players.group_number/group_order.';
comment on column public.trip_travelers.room_number is
  'Room the traveler is assigned to (1-based). Null = unassigned.';
comment on column public.trip_travelers.room_order is
  'Position within the room, for stable ordering in the admin drag-and-drop UI.';
