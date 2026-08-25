-- Track per-player opt-ins for separate buy-in side games
ALTER TABLE events ADD COLUMN IF NOT EXISTS side_game_entries JSONB DEFAULT '{}';
