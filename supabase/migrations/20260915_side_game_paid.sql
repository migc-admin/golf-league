-- Admin reconciliation for opt-in side game buy-ins. Separate from
-- side_game_entries (who opted in) so marking someone "paid" never touches
-- the opt-in roster itself. Same shape: { [gameKey]: [playerId, ...] }.
ALTER TABLE events ADD COLUMN IF NOT EXISTS side_game_paid JSONB NOT NULL DEFAULT '{}';
