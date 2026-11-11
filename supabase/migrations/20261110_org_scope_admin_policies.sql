-- ============================================================
-- Limit admin access to the admin's own club
--
-- is_admin() is true for an admin of ANY org, so every policy built on it
-- alone opened the table across clubs (e.g. any club's admin could read every
-- club's registrations, and any signed-in user could read every profile).
-- These policies now go through can_admin_event / can_admin_league, which
-- check the row's club against the signed-in admin's club.
-- Applied 2026-11-10 and verified: another club's admin reads/changes 0 rows
-- of MIGC data; MIGC admins keep full access.
-- ============================================================

create or replace function public.can_admin_event(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.events e join public.leagues l on l.id = e.league_id
    where e.id = eid and l.org_id = public.get_my_org_id() and public.is_org_admin()
  )
$$;

create or replace function public.can_admin_league(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.leagues l
    where l.id = lid and l.org_id = public.get_my_org_id() and public.is_org_admin()
  )
$$;

-- registrations (names, emails)
drop policy if exists "Admin read registrations"   on public.registrations;
drop policy if exists "Admin update registrations" on public.registrations;
drop policy if exists "Admin delete registrations" on public.registrations;
create policy "Org admin read registrations"   on public.registrations for select using (public.can_admin_event(event_id));
create policy "Org admin update registrations" on public.registrations for update using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));
create policy "Org admin delete registrations" on public.registrations for delete using (public.can_admin_event(event_id));

-- event_players
drop policy if exists "Admin write event_players" on public.event_players;
create policy "Org admin write event_players" on public.event_players for all
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));

-- imported_skins
drop policy if exists "Admin write imported_skins" on public.imported_skins;
create policy "Org admin write imported_skins" on public.imported_skins for all
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));

-- side_games
drop policy if exists "Admin write side_games" on public.side_games;
create policy "Org admin write side_games" on public.side_games for all
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));

-- skins
drop policy if exists "Admin write skins" on public.skins;
create policy "Org admin write skins" on public.skins for all
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));

-- season_earnings
drop policy if exists "Admin write season_earnings" on public.season_earnings;
create policy "Org admin write season_earnings" on public.season_earnings for all
  using (public.can_admin_league(league_id)) with check (public.can_admin_league(league_id));

-- scores (admin paths only; scorekeeper paths unchanged)
drop policy if exists "Admins can manage scores"    on public.scores;
drop policy if exists "Admin delete scores"         on public.scores;
drop policy if exists "Scorekeeper or admin insert" on public.scores;
drop policy if exists "Scorekeeper or admin update" on public.scores;
create policy "Org admin manage scores" on public.scores for all to authenticated
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));
create policy "Scorekeeper insert scores" on public.scores for insert
  with check (public.is_scorekeeper_for_event(event_id));
create policy "Scorekeeper update scores" on public.scores for update
  using (public.is_scorekeeper_for_event(event_id));

-- profiles (names, emails, roles)
drop policy if exists "Admin read profiles" on public.profiles;
create policy "Org admin read profiles" on public.profiles for select to authenticated
  using ((org_id = public.get_my_org_id() and public.is_org_admin()) or public.is_platform_admin());
