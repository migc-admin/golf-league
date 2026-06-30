create table public.match_pairings (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  player_a_id   uuid not null references public.players(id) on delete cascade,
  player_b_id   uuid not null references public.players(id) on delete cascade,
  match_number  integer not null default 1,
  created_at    timestamptz default now(),
  unique(event_id, player_a_id),
  unique(event_id, player_b_id)
);
alter table public.match_pairings enable row level security;
create policy "Public read" on public.match_pairings for select using (true);
create policy "Admin write" on public.match_pairings for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
