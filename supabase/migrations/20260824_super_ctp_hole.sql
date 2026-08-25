-- Designate a single par-3 hole for the Super CTP competition
ALTER TABLE events ADD COLUMN IF NOT EXISTS super_ctp_hole INTEGER DEFAULT NULL;
