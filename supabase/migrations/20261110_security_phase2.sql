-- ============================================================
-- Security step 2 — apply only AFTER the matching app version is live
-- (the previous app version read these directly and would break).
--
--  * players: anonymous visitors can read only names/role, not email,
--    phone, GHIN or player link tokens
--  * scores: no more anonymous direct writes; guests save through
--    guest_save_score, which checks their group code
--  * events.group_codes: emptied (codes now live in event_group_codes)
-- ============================================================

-- Players: names only for anonymous visitors
revoke select on public.players from anon;
grant select (id, first_name, last_name, intended_role, org_id, created_at) on public.players to anon;

-- Scores: guests go through guest_save_score
drop policy if exists "Anon insert scores" on public.scores;
drop policy if exists "Anon update scores" on public.scores;

-- Group codes: pick up any edits made in the old admin screen, then clear the public copy
insert into public.event_group_codes (event_id, codes)
select id, group_codes from public.events
where group_codes is not null and group_codes <> '{}'::jsonb
on conflict (event_id) do update set codes = excluded.codes, updated_at = now();

alter table public.events alter column group_codes drop default;
update public.events set group_codes = null where group_codes is not null;
-- Rejects writes from an old admin screen that still saves codes on the event
alter table public.events drop constraint if exists group_codes_moved;
alter table public.events add constraint group_codes_moved check (group_codes is null or group_codes = '{}'::jsonb);
