-- ============================================================
-- Fix IDOR vulnerabilities in RLS policies
--
-- Issues addressed:
--   1. tgl_teams / tgl_team_members / tgl_event_selections
--      Write policies allowed ANY authenticated user (not just admins)
--      to modify TGL data across any org.
--
--   2. match_pairings
--      Admin write policy was not org-scoped — any admin could
--      modify another org's match pairings.
--
--   3. score_audit_log
--      Table had no RLS migration. Enabling RLS and adding
--      org-scoped read (admin) and scorekeeper write policies.
-- ============================================================


-- ── 1. TGL TABLES ─────────────────────────────────────────────────

-- tgl_teams: scope writes to org admins only
drop policy if exists "tgl_teams_write" on public.tgl_teams;
create policy "tgl_teams_write" on public.tgl_teams for all using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.leagues l
      where l.id = league_id and l.org_id = public.get_my_org_id()
    )
  )
);

-- tgl_team_members: scope writes to org admins (via tgl_teams → leagues)
drop policy if exists "tgl_members_write" on public.tgl_team_members;
create policy "tgl_members_write" on public.tgl_team_members for all using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.tgl_teams t
      join public.leagues l on l.id = t.league_id
      where t.id = team_id and l.org_id = public.get_my_org_id()
    )
  )
);

-- tgl_event_selections: scope writes to org admins (via events → leagues)
drop policy if exists "tgl_sel_write" on public.tgl_event_selections;
create policy "tgl_sel_write" on public.tgl_event_selections for all using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.events e
      join public.leagues l on l.id = e.league_id
      where e.id = event_id and l.org_id = public.get_my_org_id()
    )
  )
);

-- tgl_event_locks (added alongside TGL tables; fix write policy too)
drop policy if exists "tgl_locks_write" on public.tgl_event_locks;
create policy "tgl_locks_write" on public.tgl_event_locks for all using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.events e
      join public.leagues l on l.id = e.league_id
      where e.id = event_id and l.org_id = public.get_my_org_id()
    )
  )
);


-- ── 2. MATCH_PAIRINGS ─────────────────────────────────────────────

drop policy if exists "Admin write" on public.match_pairings;
create policy "Admin write" on public.match_pairings for all using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.events e
      join public.leagues l on l.id = e.league_id
      where e.id = event_id and l.org_id = public.get_my_org_id()
    )
  )
);


-- ── 3. SCORE_AUDIT_LOG ────────────────────────────────────────────

alter table public.score_audit_log enable row level security;

-- Admins can read their own org's audit log; owner sees all
create policy "Admin read score_audit_log" on public.score_audit_log for select using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.events e
      join public.leagues l on l.id = e.league_id
      where e.id = event_id and l.org_id = public.get_my_org_id()
    )
  )
);

-- Scorekeepers and admins can insert (audit entries written during scoring)
create policy "Scorekeeper or admin insert score_audit_log" on public.score_audit_log for insert with check (
  public.is_owner()
  or public.is_scorekeeper_for_event(event_id)
  or (
    public.is_admin() and exists (
      select 1 from public.events e
      join public.leagues l on l.id = e.league_id
      where e.id = event_id and l.org_id = public.get_my_org_id()
    )
  )
);

-- Only admins can delete audit entries (conflict resolution)
create policy "Admin delete score_audit_log" on public.score_audit_log for delete using (
  public.is_owner()
  or (
    public.is_admin() and exists (
      select 1 from public.events e
      join public.leagues l on l.id = e.league_id
      where e.id = event_id and l.org_id = public.get_my_org_id()
    )
  )
);
