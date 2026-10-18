-- ============================================================
-- Match play wagers
--
-- Lets bettors wager on the outcome of an individual match play
-- pairing (Player A vs Player B) in addition to the existing
-- WIN / PLACE pari-mutuel bets on the field.
--
-- A match bet is a wagers row with:
--   match_pairing_id = the match being bet on
--   pick_match       = the player the bettor expects to win that match
-- and pick_1st / pick_2nd left NULL, so existing WIN / PLACE pool
-- math ignores these rows automatically.
-- ============================================================

alter table public.wagers
  add column if not exists match_pairing_id uuid references public.match_pairings(id) on delete cascade,
  add column if not exists pick_match       uuid references public.players(id) on delete cascade;

create index if not exists wagers_match_pairing_id_idx on public.wagers(match_pairing_id);
