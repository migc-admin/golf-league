-- ============================================================
-- Seasons per event
--
-- events.season_year: the season an event counts toward. A league keeps
-- running year after year; its season_year is the CURRENT season, and new
-- events take it automatically (editable per event, e.g. a January playoff
-- that belongs to last season). Standings, insights, team standings and the
-- results email count one season at a time.
-- Applied 2026-11-16; every existing event was tagged with its league's
-- season (2026).
-- ============================================================

alter table public.events add column if not exists season_year int;

update public.events e
set season_year = coalesce(l.season_year, extract(year from e.event_date)::int)
from public.leagues l
where l.id = e.league_id and e.season_year is null;

create or replace function public.events_default_season()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.season_year is null then
    select coalesce(l.season_year, extract(year from new.event_date)::int, extract(year from now())::int)
      into new.season_year
    from public.leagues l where l.id = new.league_id;
  end if;
  return new;
end $$;

drop trigger if exists events_default_season on public.events;
create trigger events_default_season before insert on public.events
  for each row execute function public.events_default_season();

create index if not exists events_league_season_idx on public.events (league_id, season_year);

-- Event web addresses: a name reused in a later season gets the year
-- ("the-vineyard-2027") before falling back to -2, -3...
create or replace function public.generate_event_slug()
returns trigger language plpgsql as $function$
declare
  base_slug   text;
  candidate   text;
  counter     int := 1;
  course_name text;
  season      int;
begin
  if new.slug is not null then
    return new;
  end if;

  select name into course_name from public.courses where id = new.course_id;

  if new.name is not null and trim(new.name) != '' then
    base_slug := lower(regexp_replace(trim(new.name), '[^a-zA-Z0-9]+', '-', 'g'));
  else
    base_slug := lower(regexp_replace(coalesce(course_name, 'event'), '[^a-zA-Z0-9]+', '-', 'g'))
                 || '-' || new.event_number;
  end if;

  base_slug := trim(both '-' from base_slug);
  candidate := base_slug;

  if exists (select 1 from public.events where league_id = new.league_id and slug = candidate and id != new.id) then
    select coalesce(new.season_year, l.season_year, extract(year from new.event_date)::int)
      into season from public.leagues l where l.id = new.league_id;
    if season is not null and base_slug !~ ('-' || season || '$') then
      base_slug := base_slug || '-' || season;
      candidate := base_slug;
    end if;
  end if;

  while exists (
    select 1 from public.events
    where league_id = new.league_id and slug = candidate and id != new.id
  ) loop
    counter   := counter + 1;
    candidate := base_slug || '-' || counter;
  end loop;

  new.slug := candidate;
  return new;
end;
$function$;
