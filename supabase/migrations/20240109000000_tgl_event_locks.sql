-- Lock TGL selections per event once finalized.
-- When locked, selections are read-only and standings count this event.
create table public.tgl_event_locks (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade unique,
  locked_at  timestamptz default now()
);

alter table public.tgl_event_locks enable row level security;
create policy "tgl_locks_read"  on public.tgl_event_locks for select using (true);
create policy "tgl_locks_write" on public.tgl_event_locks for all    using (auth.role() = 'authenticated');
