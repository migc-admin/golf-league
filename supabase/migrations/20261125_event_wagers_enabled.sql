-- ============================================================
-- Wagers on/off per event
--
-- events.wagers_enabled: whether the event offers the wager board at all.
-- Existing events were switched on (no change for them); new events start
-- off and the admin turns wagers on from the event's wager board.
-- When off, the bet form, results and ticket pages say wagers aren't
-- offered, wager links disappear from the event page, emails and player
-- links, and the public bet rule refuses new bets.
-- Applied 2026-11-25.
-- ============================================================

alter table public.events add column if not exists wagers_enabled boolean not null default true;
alter table public.events alter column wagers_enabled set default false;

drop policy if exists "Place bets on open events" on public.wagers;
create policy "Place bets on open events" on public.wagers for insert with check (
  public.can_admin_event(event_id)
  or (deleted_at is null
      and not payment_confirmed
      and exists (select 1 from public.events e
                  where e.id = event_id and e.wagers_enabled
                    and e.status <> 'complete' and not coalesce(e.wagers_closed, false)))
);
