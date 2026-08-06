-- Add num_flights to events table
-- Stores the number of competitive flights (2–25); null = no flights / single field
alter table events
  add column if not exists num_flights integer default null;
