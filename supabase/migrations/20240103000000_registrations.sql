-- Event registrations (pre-roster, pending payment confirmation)
create table if not exists public.registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text,
  handicap_index  numeric(4,1),
  flight          text check (flight in ('A', 'B')),
  notes           text,
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'cancelled')),
  created_at      timestamptz not null default now()
);

-- Venmo handle on events (used for registration payment deeplink)
alter table public.events
  add column if not exists venmo_handle text;

-- Default Venmo handle for existing events
update public.events set venmo_handle = 'SD-Mulligans-Golf' where venmo_handle is null;

create index if not exists idx_registrations_event_id on public.registrations(event_id);
create index if not exists idx_registrations_status   on public.registrations(status);

alter table public.registrations enable row level security;

-- Public can insert (anyone can register)
create policy "Public insert registrations"
  on public.registrations for insert
  with check (true);

-- Only admins can read/update/delete
create policy "Admin read registrations"
  on public.registrations for select
  using (public.is_admin());

create policy "Admin update registrations"
  on public.registrations for update
  using (public.is_admin());

create policy "Admin delete registrations"
  on public.registrations for delete
  using (public.is_admin());
