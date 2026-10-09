-- ============================================================
-- Separate match play course handicap
--
-- Lets a player carry a different Course Handicap for match play
-- than the one used for stroke play within the same event (e.g.
-- a tournament running both formats side by side with different
-- handicap allowances). Left as an open numeric override rather
-- than a fixed percentage — admins can enter whatever value their
-- rules call for. NULL (the default) means "same as stroke play".
-- ============================================================

alter table public.event_players
  add column if not exists match_play_course_handicap integer;
