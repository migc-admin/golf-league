-- Flag events that were imported from historical data (no hole-by-hole scores)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_imported boolean DEFAULT false;
