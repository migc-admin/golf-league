-- ============================================================
-- Close two self-service privilege holes found in the 2026-11-13 review.
--
--  1. profiles.is_owner / profiles.is_platform_admin were writable by the
--     row's own user ("Own profile update" has no WITH CHECK and the guard
--     trigger only covered role / org_id). Any signed-in user could make
--     themself platform admin.
--  2. organizations.tier / organizations.stripe_customer_id were writable by
--     any org admin ("Org admin update own org"), and by anyone creating an
--     org ("Authenticated users can create orgs"). A club could give itself
--     a paid plan without paying.
--
-- Who is still allowed to change these:
--   * service_role  — Edge Functions (stripe-webhook sets tier)
--   * direct database sessions (SQL editor, migrations) — no API role
--   * the platform owner (profiles.is_owner)
-- ============================================================

-- ── 1. profiles: guard the platform flags on UPDATE ─────────────────────────
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_claiming_fresh_org boolean;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Platform-level flags: API callers may change them only if they are
  -- already the platform owner.
  if (new.is_owner is distinct from old.is_owner
      or new.is_platform_admin is distinct from old.is_platform_admin)
     and auth.role() is not null
     and not public.is_owner() then
    raise exception 'Not authorized to change platform privileges';
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
$fn$;

-- ── 1b. profiles: the same rules on INSERT ──────────────────────────────────
-- The UPDATE guard alone can be sidestepped by deleting your own profile row
-- and inserting a new one. API callers can never insert the platform flags,
-- and can only attach themselves to an organization nobody belongs to yet
-- (onboarding) or, as an admin, to their own organization.
-- Signup (handle_new_user), invites and Edge Functions are not API callers
-- here and are unaffected.
create or replace function public.guard_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.role() is null or auth.role() = 'service_role' or public.is_owner() then
    return new;
  end if;

  new.is_owner          := false;
  new.is_platform_admin := false;

  if new.org_id is not null
     and exists (select 1 from public.profiles where org_id = new.org_id and id <> new.id)
     and not (public.is_admin() and new.org_id = public.get_my_org_id()) then
    raise exception 'Cannot join an existing organization';
  end if;

  return new;
end;
$fn$;

drop trigger if exists guard_profile_insert on public.profiles;
create trigger guard_profile_insert
  before insert on public.profiles
  for each row execute function public.guard_profile_insert();

-- ── 2. organizations: plan and billing fields are set by billing only ──────
-- New organizations created from the app always start on 'free'; the Stripe
-- webhook raises the tier once checkout completes.
create or replace function public.guard_org_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.role() is null or auth.role() = 'service_role' or public.is_owner() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.tier               := 'free';
    new.stripe_customer_id := null;
    return new;
  end if;

  if new.tier is distinct from old.tier
     or new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'Plan and billing fields can only be changed by Scorify billing';
  end if;

  return new;
end;
$fn$;

drop trigger if exists guard_org_billing_columns on public.organizations;
create trigger guard_org_billing_columns
  before insert or update on public.organizations
  for each row execute function public.guard_org_billing_columns();
