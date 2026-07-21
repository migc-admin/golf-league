-- ============================================================
-- Security Event Log
--
-- A queryable table for security-relevant events: auth failures,
-- rate limit hits, API errors, and unusual traffic patterns.
-- Viewable by platform owners in Supabase dashboard.
--
-- Edge functions write to this table via the service client.
-- No public or authenticated read access.
-- ============================================================

create table if not exists public.security_log (
  id          bigserial    primary key,
  event       text         not null,  -- e.g. 'auth_failure', 'rate_limited', 'api_error'
  severity    text         not null default 'info',  -- 'info' | 'warn' | 'error'
  user_id     uuid         references auth.users(id) on delete set null,
  org_id      uuid         references public.organizations(id) on delete set null,
  ip          text,
  endpoint    text,
  message     text,
  metadata    jsonb,
  created_at  timestamptz  not null default now()
);

create index if not exists security_log_event_time  on public.security_log (event, created_at desc);
create index if not exists security_log_user_time   on public.security_log (user_id, created_at desc);
create index if not exists security_log_severity    on public.security_log (severity, created_at desc);

-- No public access — only service role (edge functions) can write
alter table public.security_log enable row level security;

-- Platform owners can read the full log
create policy "Owner read security_log" on public.security_log for select
  using (public.is_owner());

-- Edge functions use service role (bypasses RLS), so no insert policy needed

-- ── Helper: write a security event (callable from edge functions via rpc) ──
create or replace function public.log_security_event(
  p_event     text,
  p_severity  text    default 'info',
  p_user_id   uuid    default null,
  p_org_id    uuid    default null,
  p_ip        text    default null,
  p_endpoint  text    default null,
  p_message   text    default null,
  p_metadata  jsonb   default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.security_log
    (event, severity, user_id, org_id, ip, endpoint, message, metadata)
  values
    (p_event, p_severity, p_user_id, p_org_id, p_ip, p_endpoint, p_message, p_metadata);
end;
$$;

grant execute on function public.log_security_event(text, text, uuid, uuid, text, text, text, jsonb)
  to service_role;
