-- Remove the single-designated-scorekeeper restriction: any player who is
-- part of a group for an event may now enter/update scores and audit log
-- entries for that event (matching the existing guest/access-code flow,
-- which never restricted scoring to a single flagged player per group).
--
-- is_scorekeeper_for_event() keeps its name (it's referenced by the scores
-- and score_audit_log RLS policies) but now checks group membership instead
-- of the is_scorekeeper flag.
create or replace function public.is_scorekeeper_for_event(p_event_id uuid)
returns bool
language sql security definer stable
as $$
  select exists (
    select 1
    from public.event_players ep
    join public.profiles pr on pr.player_id = ep.player_id
    where ep.event_id = p_event_id
      and ep.group_number is not null
      and pr.id = auth.uid()
  );
$$;
