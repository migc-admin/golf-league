-- ============================================================
-- Trip sign-up: guests, rental stay, priced questions
--
-- trips.ask_guest            — the sign-up form asks "Are you bringing a guest?"
-- trips.lodging.type         — 'hotel' | 'rental' (jsonb key, no column). For a rental the
--                              form asks "Are you staying in the rental property?" and the
--                              lodging share is charged only on Yes.
-- trips.custom_questions     — items may now be { label, required, type: 'text'|'yes_no', cost }
--                              where cost is added once to the total when the answer is Yes.
-- trip_registrations.staying — answer to the rental question (null when not asked)
-- trip_registrations.guest   — null, or { first_name, last_name, golfing, round_ids, staying }.
--                              A guest is priced exactly like the registrant.
-- ============================================================

alter table public.trips
  add column if not exists ask_guest boolean not null default false;

alter table public.trip_registrations
  add column if not exists staying boolean,
  add column if not exists guest   jsonb;

-- Same clean-up as before, now also for the guest: only rounds of this trip, none when not golfing,
-- and a guest needs a name.
create or replace function public.prepare_trip_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league uuid;
  v_guest_rounds uuid[];
begin
  if not public.check_rate_limit('trip-register:' || new.trip_id::text, 30, 60) then
    raise exception 'Too many sign-ups submitted for this trip. Please wait a moment and try again.';
  end if;

  select t.org_id, t.league_id into new.org_id, v_league from public.trips t where t.id = new.trip_id;
  new.status      := 'pending';
  new.traveler_id := null;
  new.round_ids   := coalesce(array(
    select e.id from public.events e
    where e.league_id = v_league and e.id = any(coalesce(new.round_ids, '{}'))
  ), '{}');
  if not new.golfing then new.round_ids := '{}'; end if;

  if new.guest is not null then
    if jsonb_typeof(new.guest) <> 'object'
       or coalesce(btrim(new.guest->>'first_name'), '') = ''
       or coalesce(btrim(new.guest->>'last_name'), '') = '' then
      raise exception 'A guest needs a first and last name.';
    end if;
    v_guest_rounds := case when coalesce((new.guest->>'golfing')::boolean, false) then coalesce(array(
      select e.id from public.events e
      where e.league_id = v_league
        and e.id::text in (select jsonb_array_elements_text(coalesce(new.guest->'round_ids', '[]'::jsonb)))
    ), '{}') else '{}' end;
    new.guest := jsonb_build_object(
      'first_name', btrim(new.guest->>'first_name'),
      'last_name',  btrim(new.guest->>'last_name'),
      'golfing',    coalesce((new.guest->>'golfing')::boolean, false),
      'round_ids',  to_jsonb(v_guest_rounds),
      'staying',    (new.guest->'staying')
    );
  end if;
  return new;
end;
$$;
