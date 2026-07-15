-- ============================================================
-- Org-Scoped Row Level Security
--
-- Problem: existing policies allow any authenticated admin to
-- read all orgs' data. This migration scopes all read and write
-- policies so each admin only sees their own org's data.
--
-- Public (anon) access is preserved for leaderboard, scorecard,
-- standings, and registration pages which don't require login.
-- ============================================================

-- ── Helper: get current user's org_id ────────────────────────
create or replace function public.get_my_org_id()
returns uuid
language sql security definer stable
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- ── LEAGUES ──────────────────────────────────────────────────
drop policy if exists "Auth read leagues"   on public.leagues;
drop policy if exists "Admin write leagues" on public.leagues;

create policy "Read leagues" on public.leagues for select using (
  auth.role() = 'anon'
  or org_id = public.get_my_org_id()
);
create policy "Admin write leagues" on public.leagues for all using (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- ── COURSES ──────────────────────────────────────────────────
drop policy if exists "Auth read courses"   on public.courses;
drop policy if exists "Admin write courses" on public.courses;

create policy "Read courses" on public.courses for select using (
  auth.role() = 'anon'
  or org_id = public.get_my_org_id()
);
create policy "Admin write courses" on public.courses for all using (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- ── PLAYERS ──────────────────────────────────────────────────
drop policy if exists "Auth read players"   on public.players;
drop policy if exists "Admin write players" on public.players;

create policy "Read players" on public.players for select using (
  auth.role() = 'anon'
  or org_id = public.get_my_org_id()
);
create policy "Admin write players" on public.players for all using (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- ── EVENTS (scoped through leagues) ──────────────────────────
drop policy if exists "Auth read events"   on public.events;
drop policy if exists "Admin write events" on public.events;

create policy "Read events" on public.events for select using (
  auth.role() = 'anon'
  or exists (
    select 1 from public.leagues l
    where l.id = league_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin write events" on public.events for all using (
  public.is_admin() and exists (
    select 1 from public.leagues l
    where l.id = league_id and l.org_id = public.get_my_org_id()
  )
);

-- ── EVENT_PLAYERS (scoped through events → leagues) ──────────
drop policy if exists "Auth read event_players"   on public.event_players;
drop policy if exists "Admin write event_players" on public.event_players;

create policy "Read event_players" on public.event_players for select using (
  auth.role() = 'anon'
  or exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin write event_players" on public.event_players for all using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);

-- ── SCORES ───────────────────────────────────────────────────
drop policy if exists "Auth read scores"            on public.scores;
drop policy if exists "Scorekeeper or admin insert" on public.scores;
drop policy if exists "Scorekeeper or admin update" on public.scores;
drop policy if exists "Admin delete scores"         on public.scores;

create policy "Read scores" on public.scores for select using (
  auth.role() = 'anon'
  or exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Scorekeeper or admin insert" on public.scores for insert with check (
  public.is_scorekeeper_for_event(event_id)
  or (public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  ))
);
create policy "Scorekeeper or admin update" on public.scores for update using (
  public.is_scorekeeper_for_event(event_id)
  or (public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  ))
);
create policy "Admin delete scores" on public.scores for delete using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);

-- ── SIDE_GAMES ───────────────────────────────────────────────
drop policy if exists "Auth read side_games"   on public.side_games;
drop policy if exists "Admin write side_games" on public.side_games;

create policy "Read side_games" on public.side_games for select using (
  auth.role() = 'anon'
  or exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin write side_games" on public.side_games for all using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);

-- ── SKINS ────────────────────────────────────────────────────
drop policy if exists "Auth read skins"   on public.skins;
drop policy if exists "Admin write skins" on public.skins;

create policy "Read skins" on public.skins for select using (
  auth.role() = 'anon'
  or exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin write skins" on public.skins for all using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);

-- ── SEASON_EARNINGS (scoped through leagues) ─────────────────
drop policy if exists "Auth read season_earnings"   on public.season_earnings;
drop policy if exists "Admin write season_earnings" on public.season_earnings;

create policy "Read season_earnings" on public.season_earnings for select using (
  auth.role() = 'anon'
  or exists (
    select 1 from public.leagues l
    where l.id = league_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin write season_earnings" on public.season_earnings for all using (
  public.is_admin() and exists (
    select 1 from public.leagues l
    where l.id = league_id and l.org_id = public.get_my_org_id()
  )
);

-- ── REGISTRATIONS (scoped through events → leagues) ──────────
drop policy if exists "Admin read registrations"   on public.registrations;
drop policy if exists "Admin update registrations" on public.registrations;
drop policy if exists "Admin delete registrations" on public.registrations;

create policy "Admin read registrations" on public.registrations for select using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin update registrations" on public.registrations for update using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
create policy "Admin delete registrations" on public.registrations for delete using (
  public.is_admin() and exists (
    select 1 from public.events e
    join public.leagues l on l.id = e.league_id
    where e.id = event_id and l.org_id = public.get_my_org_id()
  )
);
-- Public insert remains unchanged (anyone can register for an event)
