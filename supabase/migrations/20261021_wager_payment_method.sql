-- ============================================================
-- Wager payment method
--
-- Records whether a bettor chose to pay by Venmo or cash when they placed
-- a wager, so the admin can see who owes what and how. NULL means "not
-- recorded" (bets placed before this column existed, or not yet set).
-- ============================================================

alter table public.wagers
  add column if not exists payment_method text
  check (payment_method in ('venmo', 'cash'));
