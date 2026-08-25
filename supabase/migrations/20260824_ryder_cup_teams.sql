-- Store Ryder Cup team names per event
ALTER TABLE events ADD COLUMN IF NOT EXISTS ryder_cup_teams JSONB DEFAULT '{"a": "", "b": ""}';
