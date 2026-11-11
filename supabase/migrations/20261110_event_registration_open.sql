-- ============================================================
-- Registration on/off switch per event
--
-- events.registration_open: when false the public event page stays up but
-- shows no Register button, and the database refuses new registrations.
-- New events start closed. Registrations are only accepted for upcoming events.
-- ============================================================

alter table public.events add column if not exists registration_open boolean not null default false;

-- Keep today's behavior for current events (registration was open for every upcoming
-- event), except the DLo Invitational, which was found open before it was announced.
update public.events set registration_open = true
where status in ('upcoming', 'active') and id <> '104ba21b-484b-4292-a9a7-e08cb37bfe37';

drop policy if exists "Public insert registrations" on public.registrations;
create policy "Public insert registrations" on public.registrations
  for insert to public with check (
    exists (select 1 from public.events e
            where e.id = event_id and e.registration_open and e.status = 'upcoming')
  );
