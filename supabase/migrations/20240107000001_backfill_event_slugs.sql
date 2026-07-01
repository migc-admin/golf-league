-- Backfill slugs for existing events that don't have one
-- This calls the same logic as the trigger by temporarily nulling and re-setting
update public.events set slug = null where slug is null;
-- The trigger will fire and set slugs automatically on the update above
-- Verify:
select e.id, e.event_number, e.name, c.name as course_name, e.slug
from public.events e
join public.courses c on c.id = e.course_id
order by e.league_id, e.event_number;
