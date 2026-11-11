-- ============================================================
-- Security step 1 (applied 2026-11-10, safe with the previous app version)
--
--  * event_group_codes: group scoring codes move to an admin-only table
--    (events.group_codes was readable by anyone and shown on public pages)
--  * group_for_code / guest_save_score: code checks and guest score saves
--    happen on the server (the code must match the player's group; finished
--    events are closed)
--  * player_link_profile / player_link_code: player links (/p/:token) look up
--    the player and their group code on the server
--  * wagers: anyone may place a bet on an open event; only that club's admins
--    can change or delete bets
--  * trip_travelers: anonymous visitors can't read admin notes
-- ============================================================

create table if not exists public.event_group_codes (
  event_id   uuid primary key references public.events(id) on delete cascade,
  codes      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.event_group_codes enable row level security;
create policy "Org admin manage group codes" on public.event_group_codes for all to authenticated
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));

insert into public.event_group_codes (event_id, codes)
select id, group_codes from public.events
where group_codes is not null and group_codes <> '{}'::jsonb
on conflict (event_id) do update set codes = excluded.codes, updated_at = now();

create or replace function public.group_for_code(p_event_id uuid, p_code text)
returns int language sql stable security definer set search_path = public as $$
  select c.key::int
  from public.event_group_codes g, jsonb_each_text(g.codes) c
  where g.event_id = p_event_id
    and length(trim(coalesce(p_code, ''))) > 0
    and upper(trim(c.value)) = upper(trim(p_code))
  limit 1
$$;

create or replace function public.guest_save_score(
  p_event_id uuid, p_code text, p_player_id uuid, p_hole int,
  p_gross int, p_putts int, p_entered_by text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_group    int;
  v_status   text;
  v_existing record;
  v_conflict boolean;
begin
  v_group := public.group_for_code(p_event_id, p_code);
  if v_group is null then raise exception 'Group code not recognized' using errcode = '28000'; end if;

  select status into v_status from public.events where id = p_event_id;
  if v_status is null or v_status = 'complete' then raise exception 'Scoring is closed for this event' using errcode = '42501'; end if;

  if not exists (select 1 from public.event_players
                 where event_id = p_event_id and player_id = p_player_id and group_number = v_group) then
    raise exception 'That player is not in your group' using errcode = '42501';
  end if;
  if p_hole is null or p_hole < 1 or p_hole > 18 then raise exception 'Invalid hole' using errcode = '22023'; end if;
  if p_gross is null or p_gross < 1 or p_gross > 30 then raise exception 'Invalid score' using errcode = '22023'; end if;
  if p_putts is not null and (p_putts < 0 or p_putts > 15) then raise exception 'Invalid putts' using errcode = '22023'; end if;

  select gross_score, entered_by into v_existing from public.scores
  where event_id = p_event_id and player_id = p_player_id and hole_number = p_hole;

  v_conflict := v_existing.entered_by is not null
                and v_existing.entered_by is distinct from p_entered_by
                and v_existing.gross_score is distinct from p_gross;

  insert into public.score_audit_log (event_id, player_id, hole_number, new_score, previous_score,
                                      entered_by, previous_entered_by, is_conflict)
  values (p_event_id, p_player_id, p_hole, p_gross, v_existing.gross_score,
          coalesce(p_entered_by, 'unknown'), v_existing.entered_by, v_conflict);

  insert into public.scores (event_id, player_id, hole_number, gross_score, putts, entered_by)
  values (p_event_id, p_player_id, p_hole, p_gross, p_putts, p_entered_by)
  on conflict (event_id, player_id, hole_number)
  do update set gross_score = excluded.gross_score, putts = excluded.putts,
                entered_by = excluded.entered_by, updated_at = now();

  return jsonb_build_object('conflict', v_conflict);
end $$;

create or replace function public.player_link_profile(p_token text)
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name from public.players p
  where length(coalesce(p_token, '')) >= 8 and p.player_link_token = p_token
  limit 1
$$;

create or replace function public.player_link_code(p_token text, p_event_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select g.codes ->> ep.group_number::text
  from public.players p
  join public.event_players ep on ep.player_id = p.id and ep.event_id = p_event_id
  join public.events e on e.id = ep.event_id and e.status = 'active'
  join public.event_group_codes g on g.event_id = ep.event_id
  where length(coalesce(p_token, '')) >= 8 and p.player_link_token = p_token
  limit 1
$$;

revoke all on function public.group_for_code(uuid, text) from public;
revoke all on function public.guest_save_score(uuid, text, uuid, int, int, int, text) from public;
revoke all on function public.player_link_profile(text) from public;
revoke all on function public.player_link_code(text, uuid) from public;
grant execute on function public.group_for_code(uuid, text) to anon, authenticated;
grant execute on function public.guest_save_score(uuid, text, uuid, int, int, int, text) to anon, authenticated;
grant execute on function public.player_link_profile(text) to anon, authenticated;
grant execute on function public.player_link_code(text, uuid) to anon, authenticated;

-- Wagers. (venmo_sent defaults to true, so it is not part of the public check.)
drop policy if exists "public insert" on public.wagers;
drop policy if exists "Allow public update on wagers" on public.wagers;
drop policy if exists "Delete removed wagers" on public.wagers;
drop policy if exists "Place bets on open events" on public.wagers;
create policy "Place bets on open events" on public.wagers for insert with check (
  public.can_admin_event(event_id)
  or (deleted_at is null
      and exists (select 1 from public.events e
                  where e.id = event_id and e.status <> 'complete' and not coalesce(e.wagers_closed, false)))
);
create policy "Org admin update wagers" on public.wagers for update
  using (public.can_admin_event(event_id)) with check (public.can_admin_event(event_id));
create policy "Org admin delete wagers" on public.wagers for delete
  using (public.can_admin_event(event_id));

-- Trip travelers: public trip pages don't need admin notes
revoke select on public.trip_travelers from anon;
grant select (id, trip_id, org_id, player_id, guest_name, room_number, room_order, created_at) on public.trip_travelers to anon;
