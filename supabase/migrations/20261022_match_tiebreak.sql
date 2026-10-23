-- ============================================================
-- Match play tiebreakers
--
-- Some events (playoffs, bracket matches) need a winner for every
-- match, so a match that is all square after 18 holes cannot be halved.
--
--   events.match_rules          { "requireWinner": true, "preset": "full" }
--                               preset = full | countback | manual
--                               NULL = default behavior (ties are halved)
--   match_pairings.winner_player_id  admin's manual decision for a tied match
--   match_pairings.winner_note       optional reason, for the record
-- ============================================================

alter table public.events
  add column if not exists match_rules jsonb;

alter table public.match_pairings
  add column if not exists winner_player_id uuid references public.players(id) on delete set null,
  add column if not exists winner_note      text;
