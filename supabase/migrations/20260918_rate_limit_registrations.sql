-- The public "Public insert registrations" policy on public.registrations
-- (with check (true)) has no abuse control — unlike every other anon-writable
-- path in the app (account creation, invites), it never calls the existing
-- check_rate_limit() helper. An anonymous visitor could script thousands of
-- fake registrations against a single event with no friction.
--
-- This adds a before-insert trigger that caps registrations per event to a
-- generous burst limit (30 per rolling 60 seconds) — enough for a real rush
-- of golfers registering at once, but bounds a scripted flood.

create or replace function public.enforce_registration_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_rate_limit('register:' || new.event_id::text, 30, 60) then
    raise exception 'Too many registrations submitted for this event. Please wait a moment and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_rate_limit on public.registrations;

create trigger registrations_rate_limit
  before insert on public.registrations
  for each row
  execute function public.enforce_registration_rate_limit();
