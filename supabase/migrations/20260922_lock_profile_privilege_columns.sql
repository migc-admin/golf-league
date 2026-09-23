-- ============================================================
-- Close privilege-escalation gaps on public.profiles
--
-- Three related holes, all stemming from `role`/`org_id` never being
-- protected as privileged columns:
--
--   1. handle_new_user() copied `role`/`org_id` straight from client-supplied
--      auth signup metadata. Since the Supabase anon key is public, anyone
--      could call supabase.auth.signUp() directly with
--      { data: { role: 'admin', org_id: '<any-org-id>' } } and become a full
--      admin of any org — no invite required. Org IDs aren't secret (visible
--      on any public league/event page).
--
--   2. "Own profile update" (auth.uid() = id) has no WITH CHECK, so any
--      signed-up user (role defaults to 'scorekeeper') can self-promote via
--      `supabase.from('profiles').update({ role: 'admin', org_id: <target> })`.
--
--   3. "Admin all profiles" is `using (is_owner() or is_admin())` with no org
--      scoping — unlike every sibling policy added in the same migration
--      (leagues/courses/players/events/scores/event_players). Any org admin
--      can read every org's profiles (PII leak) and write/delete rows
--      belonging to a different org, including reassigning their own org_id.
--
-- Fix: only trust signup metadata for actual Supabase-invited users, add a
-- BEFORE UPDATE trigger that pins role/org_id to legitimate actors, and scope
-- "Admin all profiles" to the caller's own org like its siblings.
-- ============================================================

-- ── 1. handle_new_user(): only honor role/org_id metadata for invited users ──
-- auth.users.invited_at is set by Supabase only for admin.inviteUserByEmail()
-- (the invite-admin Edge Function's flow) — never for a self-service signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, org_id)
  values (
    new.id,
    case when new.invited_at is not null
         then coalesce(new.raw_user_meta_data->>'role', 'admin')
         else 'scorekeeper'
    end,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when new.invited_at is not null
         then (new.raw_user_meta_data->>'org_id')::uuid
         else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 2/3. Guard trigger: role/org_id can only change via a legitimate actor ──
-- org_id: only a platform owner may change it, UNLESS the caller currently
--   has no org (old.org_id is null) AND the org they're claiming has no
--   profiles in it yet — this is the Onboarding.jsx self-serve flow, where a
--   brand-new user creates a brand-new org and then upserts their own
--   profile to attach to it. Since Onboarding.jsx always inserts the org row
--   immediately before this upsert, the org is guaranteed to have zero
--   existing profiles in the legitimate case. An attacker with org_id = null
--   trying to attach themselves to an EXISTING (populated) org is still
--   blocked, because that org already has at least one profile.
-- role: same carve-out applies, additionally restricted to the 'admin' role
--   (matches Onboarding.jsx, the only self-serve path) — otherwise, only a
--   platform owner, or an admin acting on a profile that was already in
--   their own org, may change it (matches the existing Players.jsx /
--   Import.jsx "change teammate's role" admin features, which only ever
--   operate on same-org profiles).
-- Applies regardless of which RLS policy allowed the UPDATE, so it also
-- closes the "Own profile update" self-escalation path.
--
-- service_role is exempted: it's the backend-only key used by Edge Functions
-- (invite-admin, create-player-login), which already independently verify
-- the calling admin owns the target org before writing — confirmed via
-- codebase search that no other service_role write touches role/org_id.
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claiming_fresh_org boolean;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  v_claiming_fresh_org :=
    old.org_id is null
    and new.org_id is not null
    and not exists (
      select 1 from public.profiles where org_id = new.org_id
    );

  if new.org_id is distinct from old.org_id
     and not public.is_owner()
     and not v_claiming_fresh_org then
    raise exception 'org_id cannot be changed';
  end if;

  if new.role is distinct from old.role
     and not public.is_owner()
     and not (public.is_admin() and old.org_id = public.get_my_org_id())
     and not (v_claiming_fresh_org and new.role = 'admin') then
    raise exception 'Not authorized to change role';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privilege_columns on public.profiles;
create trigger guard_profile_privilege_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_columns();

-- ── 3. Scope "Admin all profiles" to the admin's own org ────────────────────
drop policy if exists "Admin all profiles" on public.profiles;
create policy "Admin all profiles" on public.profiles for all
  using      (public.is_owner() or (public.is_admin() and org_id = public.get_my_org_id()))
  with check (public.is_owner() or (public.is_admin() and org_id = public.get_my_org_id()));
