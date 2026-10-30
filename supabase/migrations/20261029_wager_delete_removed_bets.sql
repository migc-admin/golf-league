-- ============================================================
-- Let the app erase wager bets that were already removed (hidden)
--
-- Removing a bet on the wager board only sets deleted_at. Those hidden rows still reference their
-- match, which blocks deleting the match. Deleting a match now erases its hidden bets first, which
-- needs a DELETE policy. It is scoped to hidden rows only: a live bet (deleted_at is null) can never
-- be deleted through it.
-- ============================================================

drop policy if exists "Delete removed wagers" on public.wagers;
create policy "Delete removed wagers"
  on public.wagers for delete
  to public
  using (deleted_at is not null);
