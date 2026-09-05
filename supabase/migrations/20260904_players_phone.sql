-- Phone number on the player roster.
-- Nullable: existing players have no phone on file, and it stays optional going forward.
alter table public.players add column if not exists phone text;
