-- Add event format, start time, and tee time interval
-- format: net_stroke | stableford | match_points | ryder_cup
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'net_stroke',
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS tee_time_interval_mins INTEGER NOT NULL DEFAULT 10;
