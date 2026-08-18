-- Optional per-tee stroke index support.
-- courses.stroke_index remains the course-level default/fallback array.
-- When per_tee_stroke_index is true, each entry in courses.tees (jsonb)
-- may carry its own `stroke_index` array that engines should prefer.
alter table public.courses
  add column if not exists per_tee_stroke_index boolean not null default false;
