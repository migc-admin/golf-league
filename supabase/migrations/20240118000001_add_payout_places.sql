-- payout_places: stores places-to-pay per scoring format
-- e.g. { "net_stroke": 3, "stableford": 1 }
alter table events
  add column if not exists payout_places jsonb default null;
