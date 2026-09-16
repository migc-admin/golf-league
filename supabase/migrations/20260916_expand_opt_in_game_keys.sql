-- Expand the onsite QR opt-in RPC (see 20260914_side_game_opt_in.sql) to accept
-- any of the 7 side games that can be flagged "Separate buy-in" on an event
-- (skins, long_drive, low_putts, ctp, super_ctp, super_skins, blind_partners),
-- not just the legacy always-opt-in trio (super_skins, super_ctp, blind_partners).
--
-- `create or replace` keeps the exact same signature/grants — only the
-- game-key whitelist inside the function body changes.

create or replace function public.opt_in_side_games(
  p_event_id  uuid,
  p_player_id uuid,
  p_game_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entries jsonb;
  v_key     text;
  v_arr     jsonb;
  v_joined  text[] := '{}';
  v_already text[] := '{}';
begin
  if not exists (
    select 1 from public.event_players
    where event_id = p_event_id and player_id = p_player_id
  ) then
    raise exception 'Player is not on this event roster';
  end if;

  select coalesce(side_game_entries, '{}'::jsonb) into v_entries
  from public.events where id = p_event_id
  for update;  -- row lock: prevents concurrent QR scans from clobbering each other's arrays

  if not found then
    raise exception 'Event not found';
  end if;

  foreach v_key in array p_game_keys loop
    if v_key not in ('skins', 'long_drive', 'low_putts', 'ctp', 'super_ctp', 'super_skins', 'blind_partners') then
      raise exception 'Invalid game key: %', v_key;
    end if;
    v_arr := coalesce(v_entries -> v_key, '[]'::jsonb);
    if v_arr @> to_jsonb(p_player_id::text) then
      v_already := array_append(v_already, v_key);
    else
      v_entries := jsonb_set(v_entries, array[v_key], v_arr || to_jsonb(p_player_id::text), true);
      v_joined  := array_append(v_joined, v_key);
    end if;
  end loop;

  update public.events set side_game_entries = v_entries where id = p_event_id;

  return jsonb_build_object('joined', v_joined, 'already', v_already);
end;
$$;

grant execute on function public.opt_in_side_games(uuid, uuid, text[]) to anon, authenticated;
