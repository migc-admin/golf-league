-- ============================================================
-- Atomic player merge + protect bet records from silent deletes
--
-- Problem: the Players page merge only repointed five tables (event entries,
-- scores, registrations, team members, event selections). Bets, match pairings,
-- side game winners, trip travelers and anything added later still pointed at the
-- profile being deleted. Some of those links delete their rows when the player is
-- deleted, so a merge that got past the error would have silently wiped them; the
-- others blocked the delete and left a half-finished merge.
--
-- Fix: merge_players(source, target) runs in ONE transaction. It repoints every
-- foreign key that references players (found dynamically, so new tables are
-- covered automatically), then deletes the source. If anything fails, nothing changes.
-- ============================================================

-- Bets are money records: never delete (or blank) them just because a player or match is removed.
-- Any link from wagers to players that cascades or nulls on delete becomes "no action" (blocks the delete).
do $$
declare r record;
begin
  for r in
    select c.conname, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.conrelid  = 'public.wagers'::regclass
      and c.confrelid = 'public.players'::regclass
      and c.confdeltype not in ('a', 'r')
  loop
    execute format('alter table public.wagers drop constraint %I', r.conname);
    execute format('alter table public.wagers add constraint %I foreign key (%I) references public.players(id)', r.conname, r.attname);
  end loop;
end $$;

alter table public.wagers drop constraint if exists wagers_match_pairing_id_fkey;
alter table public.wagers add  constraint wagers_match_pairing_id_fkey
  foreign key (match_pairing_id) references public.match_pairings(id);

create or replace function public.merge_players(source_id uuid, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  s_email  text;
  s_phone  text;
  s_ghin   text;
begin
  if not (public.is_admin() or public.is_owner()) then
    raise exception 'Only admins can merge players';
  end if;
  if source_id is null or target_id is null or source_id = target_id then
    raise exception 'Pick two different players to merge';
  end if;
  if not exists (select 1 from public.players where id = source_id)
     or not exists (select 1 from public.players where id = target_id) then
    raise exception 'Player not found';
  end if;

  -- Both profiles entered in the same event cannot be combined automatically
  if exists (
    select 1 from public.event_players a
    join public.event_players b on a.event_id = b.event_id
    where a.player_id = source_id and b.player_id = target_id
  ) then
    raise exception 'Both profiles are entered in the same event. Remove one of them from that event first, then merge.';
  end if;

  -- Carry contact details over to the target if it is missing them
  select email, phone, ghin_number into s_email, s_phone, s_ghin from public.players where id = source_id;
  update public.players set email = null where id = source_id;   -- email is unique: free it first
  update public.players
     set email       = coalesce(email, s_email),
         phone       = coalesce(phone, s_phone),
         ghin_number = coalesce(ghin_number, s_ghin)
   where id = target_id;

  -- Repoint every table that references players(id)
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.players'::regclass
      and array_length(c.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col)
      using target_id, source_id;
  end loop;

  -- Team match sides are stored as JSON keyed by player id
  begin
    update public.events
       set team_match_config = replace(team_match_config::text, source_id::text, target_id::text)::jsonb
     where team_match_config is not null
       and team_match_config::text like '%' || source_id::text || '%';
  exception when undefined_column then
    null; -- column not present in this database: nothing to update
  end;

  delete from public.players where id = source_id;

exception
  when unique_violation then
    raise exception 'These profiles overlap (for example both are paired in the same match). Remove the duplicate entry, then merge again.';
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated;
