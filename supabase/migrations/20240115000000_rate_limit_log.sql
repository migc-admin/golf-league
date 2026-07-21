-- ============================================================
-- Rate Limiting Infrastructure
--
-- A lightweight Postgres-based rate limiter used by Edge Functions.
-- No Redis or external infrastructure required.
--
-- Usage from Edge Functions (via service client):
--   const { data: allowed } = await serviceClient.rpc('check_rate_limit', {
--     p_key:            'invite:user-uuid',
--     p_max_count:      5,
--     p_window_seconds: 3600
--   })
--   if (!allowed) return 429
-- ============================================================

-- Log table: one row per request attempt, keyed by a namespaced string
create table if not exists public.rate_limit_log (
  id         bigserial    primary key,
  key        text         not null,
  created_at timestamptz  not null default now()
);

create index if not exists rate_limit_log_key_time
  on public.rate_limit_log (key, created_at);

-- No public or authenticated access — only the security definer function writes here
alter table public.rate_limit_log enable row level security;
-- (No policies — only accessible via the security definer function below)

-- ── check_rate_limit ─────────────────────────────────────────────
-- Returns TRUE if the request is allowed, FALSE if rate limited.
-- Side effect: logs the attempt and prunes old entries for the key.
create or replace function public.check_rate_limit(
  p_key            text,
  p_max_count      int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer        -- runs as owner, bypasses RLS on rate_limit_log
set search_path = public
as $$
declare
  v_count int;
  v_since timestamptz := now() - (p_window_seconds || ' seconds')::interval;
begin
  -- Prune stale entries for this key
  delete from public.rate_limit_log
  where key = p_key and created_at < v_since;

  -- Count recent attempts
  select count(*) into v_count
  from public.rate_limit_log
  where key = p_key and created_at >= v_since;

  if v_count >= p_max_count then
    return false;  -- rate limited
  end if;

  -- Record this attempt
  insert into public.rate_limit_log (key) values (p_key);

  return true;  -- allowed
end;
$$;

-- Grant execute to authenticated and anon roles so edge functions
-- calling via the service client can invoke it
grant execute on function public.check_rate_limit(text, int, int)
  to authenticated, anon, service_role;
