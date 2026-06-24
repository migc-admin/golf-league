-- Add long_drive_hole to events so admins can designate which hole is the Long Drive contest
alter table public.events
  add column if not exists long_drive_hole smallint;
