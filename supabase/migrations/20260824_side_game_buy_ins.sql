-- Add side_game_buy_ins JSONB to store per-game separate buy-in config
ALTER TABLE events ADD COLUMN IF NOT EXISTS side_game_buy_ins JSONB DEFAULT '{}';
