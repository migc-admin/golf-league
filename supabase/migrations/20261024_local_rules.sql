-- ============================================================
-- Local rules
--
-- Free-text local rules for an event (supports **bold** and *italic*).
-- Shown to players as a notice in the scoring app, in a "Local Rules"
-- section on the public event page, and in the pre-round email.
-- NULL / empty = no local rules.
-- ============================================================

alter table public.events
  add column if not exists local_rules text;
