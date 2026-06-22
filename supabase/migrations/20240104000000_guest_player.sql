-- Add is_guest flag to event_players
-- Guests: no handicap, no flight, excluded from payout counts and leaderboards
alter table public.event_players
  add column if not exists is_guest boolean not null default false;
