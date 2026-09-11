-- Trip info: structured fields for airports, lodging, meals, and social events
-- (Golf Trip itinerary follow-up). Replaces the freeform `lodging_info` column
-- with a structured `lodging` object; adds structured lists for airports,
-- meals, and social events. `itinerary` (general day-by-day notes) and
-- `travel_info` (freeform flights/rental car notes) are unchanged.

alter table public.trips
  add column if not exists nearest_airports jsonb not null default '[]'::jsonb;

alter table public.trips
  add column if not exists lodging jsonb not null default '{}'::jsonb;

alter table public.trips
  add column if not exists meals jsonb not null default '[]'::jsonb;

alter table public.trips
  add column if not exists social_events jsonb not null default '[]'::jsonb;

alter table public.trips
  drop column if exists lodging_info;

comment on column public.trips.nearest_airports is
  'Array of { code, name, distance } entries, e.g. { "code": "MCO", "name": "Orlando Intl", "distance": "45 min" }.';
comment on column public.trips.lodging is
  'Base camp / lodging details: { name, address, booking_company, checkin_date, checkin_time, checkout_date, checkout_time }.';
comment on column public.trips.meals is
  'Array of scheduled meals: { day, time, name, location } entries, e.g. { "day": "Fri, Jun 12", "time": "7:00 PM", "name": "Group Dinner", "location": "The Grill House" }.';
comment on column public.trips.social_events is
  'Array of scheduled social events: { day, time, name, location } entries (same shape as meals).';
