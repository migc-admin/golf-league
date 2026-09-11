-- Trip itinerary, lodging, and travel info (Golf Trip Phase 1 follow-up)
-- Adds freeform trip-info fields to the existing `trips` table.

alter table public.trips
  add column if not exists itinerary jsonb not null default '[]'::jsonb;

alter table public.trips
  add column if not exists lodging_info text;

alter table public.trips
  add column if not exists travel_info text;

comment on column public.trips.itinerary is
  'Freeform day-by-day schedule. Array of { label: string, text: string } entries, e.g. { "label": "Fri, Jun 12", "text": "3pm arrival · 6pm group dinner at ..." }. Also used for social-event entries (no separate table).';
comment on column public.trips.lodging_info is
  'Freeform lodging details (hotel/house name, address, check-in/out, confirmation #).';
comment on column public.trips.travel_info is
  'Freeform travel/transportation details (flights, group transport, rental cars).';
