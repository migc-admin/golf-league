-- The original check constraint on side_games.game_type only allowed
-- ('long_drive', 'ctp', 'low_putts'), but EventDetail.jsx's TabSideGames
-- has always written 'super_ctp' (Super CTP winner) and 'custom_0',
-- 'custom_1', ... (custom competitions) rows too. Any attempt to save a
-- Super CTP or custom-competition winner fails with:
--   new row for relation "side_games" violates check constraint
--   "side_games_game_type_check"
-- regardless of which player is selected — this widens the constraint to
-- match what the app actually writes.

alter table public.side_games
  drop constraint side_games_game_type_check;

alter table public.side_games
  add constraint side_games_game_type_check
  check (
    game_type in ('long_drive', 'ctp', 'low_putts', 'super_ctp')
    or game_type ~ '^custom_[0-9]+$'
  );
