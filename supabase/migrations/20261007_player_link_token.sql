-- ============================================================
-- Persistent per-player link token
--
-- Gives every player a permanent, unguessable token that
-- resolves (via /p/:token) to whatever event they're actively
-- playing in today, bypassing the group access-code step.
-- Meant to be encoded onto a QR code and/or physical NFC tag
-- that lives on the player's bag.
--
-- Possession of the link/tag is the credential — no extra PIN.
-- ============================================================

alter table public.players
  add column if not exists player_link_token text
    default replace(gen_random_uuid()::text, '-', '');

-- Backfill any existing rows created before the default existed
update public.players
  set player_link_token = replace(gen_random_uuid()::text, '-', '')
  where player_link_token is null;

alter table public.players
  add constraint players_player_link_token_key unique (player_link_token);

create index if not exists players_player_link_token_idx
  on public.players (player_link_token);
