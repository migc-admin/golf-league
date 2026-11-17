-- ============================================================
-- Wager payment confirmed
--
-- wagers.payment_method is what the bettor chose on the bet form (how they
-- plan to pay). payment_confirmed is the admin's tick once the money has
-- actually arrived. Only that club's admins can set it; a bet placed from the
-- public form always starts unconfirmed.
-- Applied 2026-11-16.
-- ============================================================

alter table public.wagers add column if not exists payment_confirmed boolean not null default false;

drop policy if exists "Place bets on open events" on public.wagers;
create policy "Place bets on open events" on public.wagers for insert with check (
  public.can_admin_event(event_id)
  or (deleted_at is null
      and not payment_confirmed
      and exists (select 1 from public.events e
                  where e.id = event_id and e.status <> 'complete' and not coalesce(e.wagers_closed, false)))
);
