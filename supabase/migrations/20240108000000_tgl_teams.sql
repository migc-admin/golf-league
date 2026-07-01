-- TGL (Team Golf League) tables
-- Teams are season-long at the league level.
-- Admin assigns players to teams. Captain (admin) selects 2 per event.

-- Fixed teams per league (4 teams)
create table public.tgl_teams (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  name       text not null,
  color      text not null default '#6b7280',  -- tailwind-compatible hex
  created_at timestamptz default now(),
  unique(league_id, name)
);

-- Season-long roster: which players belong to each team
create table public.tgl_team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.tgl_teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  unique(team_id, player_id)
);

-- Per-event player selections: which 2 players represent each team in an event
create table public.tgl_event_selections (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events(id) on delete cascade,
  team_id   uuid not null references public.tgl_teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  unique(event_id, team_id, player_id),
  unique(event_id, player_id)  -- a player can only play for one team per event
);

-- RLS: admins can manage, public can read
alter table public.tgl_teams enable row level security;
alter table public.tgl_team_members enable row level security;
alter table public.tgl_event_selections enable row level security;

create policy "tgl_teams_read"   on public.tgl_teams          for select using (true);
create policy "tgl_teams_write"  on public.tgl_teams          for all    using (auth.role() = 'authenticated');
create policy "tgl_members_read" on public.tgl_team_members   for select using (true);
create policy "tgl_members_write"on public.tgl_team_members   for all    using (auth.role() = 'authenticated');
create policy "tgl_sel_read"     on public.tgl_event_selections for select using (true);
create policy "tgl_sel_write"    on public.tgl_event_selections for all    using (auth.role() = 'authenticated');
