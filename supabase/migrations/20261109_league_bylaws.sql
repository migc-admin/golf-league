-- ============================================================
-- League rules & bylaws
--
-- One row per league: the pasted bylaws text and an on/off switch.
-- The public (no login) can read a league's bylaws only while
-- is_public is on; org members can always read; org admins write.
-- Shown on the public league page in a "Rules & bylaws" tab.
-- ============================================================

-- A first version briefly added leagues.bylaws; it was never used.
alter table public.leagues drop column if exists bylaws;

create table if not exists public.league_bylaws (
  league_id  uuid primary key references public.leagues(id) on delete cascade,
  body       text not null default '',
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.league_bylaws enable row level security;

create policy "Public read published bylaws" on public.league_bylaws
  for select to public using (is_public);

create policy "Org read bylaws" on public.league_bylaws
  for select to authenticated using (
    exists (select 1 from public.leagues l where l.id = league_id
            and (l.org_id = public.get_my_org_id() or public.is_platform_admin()))
  );

create policy "Org admin write bylaws" on public.league_bylaws
  for all to authenticated using (
    exists (select 1 from public.leagues l where l.id = league_id
            and ((l.org_id = public.get_my_org_id() and public.is_org_admin()) or public.is_platform_admin()))
  ) with check (
    exists (select 1 from public.leagues l where l.id = league_id
            and ((l.org_id = public.get_my_org_id() and public.is_org_admin()) or public.is_platform_admin()))
  );
