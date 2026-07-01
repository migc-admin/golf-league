-- Add slug column to events
alter table public.events add column if not exists slug text;

-- Unique within a league (same slug can exist in different leagues)
create unique index if not exists events_league_slug_unique on public.events(league_id, slug);

-- Auto-slug function: uses event name if set, otherwise course name + event number
create or replace function public.generate_event_slug()
returns trigger language plpgsql as $$
declare
  base_slug text;
  candidate text;
  counter   int := 1;
  course_name text;
begin
  -- Only generate if slug not already set
  if new.slug is not null then
    return new;
  end if;

  -- Get course name for fallback
  select name into course_name from public.courses where id = new.course_id;

  -- Use event name if set, otherwise course name + event number
  if new.name is not null and trim(new.name) != '' then
    base_slug := lower(regexp_replace(trim(new.name), '[^a-zA-Z0-9]+', '-', 'g'));
  else
    base_slug := lower(regexp_replace(coalesce(course_name, 'event'), '[^a-zA-Z0-9]+', '-', 'g'))
                 || '-' || new.event_number;
  end if;

  base_slug := trim(both '-' from base_slug);
  candidate := base_slug;

  -- If slug taken within this league, append -2, -3, etc.
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
$$;

-- Trigger fires on insert when slug is null, and on update of name/course_id/event_number when slug is null
create or replace trigger events_auto_slug
  before insert or update on public.events
  for each row
  when (new.slug is null)
  execute function public.generate_event_slug();
