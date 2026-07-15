-- Add is_owner flag for platform-level superadmin access
-- Owner bypasses all org-scoped RLS and can see/manage all data

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

-- Helper function
create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_owner from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Set the platform owner
update public.profiles
set is_owner = true
where id = '556c5990-94ed-4676-91c6-3ae292c214dc';

-- ── Update RLS policies to grant owner full access ────────────────────────────

-- leagues
drop policy if exists "Admin manage leagues"  on public.leagues;
drop policy if exists "Admin read leagues"    on public.leagues;
create policy "Admin manage leagues" on public.leagues for all
  using (public.is_owner() or (public.is_admin() and org_id = public.get_my_org_id()));

-- courses
drop policy if exists "Admin manage courses"  on public.courses;
drop policy if exists "Admin read courses"    on public.courses;
create policy "Admin manage courses" on public.courses for all
  using (public.is_owner() or (public.is_admin() and org_id = public.get_my_org_id()));

-- players
drop policy if exists "Admin manage players"  on public.players;
drop policy if exists "Admin read players"    on public.players;
create policy "Admin manage players" on public.players for all
  using (public.is_owner() or (public.is_admin() and org_id = public.get_my_org_id()));

-- profiles
drop policy if exists "Admin all profiles"    on public.profiles;
create policy "Admin all profiles" on public.profiles for all
  using (public.is_owner() or public.is_admin());

-- organizations
drop policy if exists "Admin manage org"      on public.organizations;
create policy "Admin manage org" on public.organizations for all
  using (public.is_owner() or (public.is_admin() and id = public.get_my_org_id()));

-- events (chained through leagues)
drop policy if exists "Admin manage events"   on public.events;
create policy "Admin manage events" on public.events for all
  using (
    public.is_owner() or (
      public.is_admin() and exists (
        select 1 from public.leagues l
        where l.id = league_id and l.org_id = public.get_my_org_id()
      )
    )
  );

-- scores
drop policy if exists "Admin manage scores"   on public.scores;
create policy "Admin manage scores" on public.scores for all
  using (
    public.is_owner() or (
      public.is_admin() and exists (
        select 1 from public.events e
        join public.leagues l on l.id = e.league_id
        where e.id = event_id and l.org_id = public.get_my_org_id()
      )
    )
  );

-- event_players
drop policy if exists "Admin manage event_players" on public.event_players;
create policy "Admin manage event_players" on public.event_players for all
  using (
    public.is_owner() or (
      public.is_admin() and exists (
        select 1 from public.events e
        join public.leagues l on l.id = e.league_id
        where e.id = event_id and l.org_id = public.get_my_org_id()
      )
    )
  );
