-- ============================================================
-- Golf League Management App — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- User profiles (extends auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'scorekeeper'
                check (role in ('admin', 'scorekeeper')),
  player_id   uuid,          -- linked player record (set after player created)
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Leagues
create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  season_year  int  not null,
  created_at   timestamptz not null default now()
);

-- Courses
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slope         int  not null default 113,
  rating        numeric(4,1) not null,
  par           int  not null default 72,     -- total par (sum of par_per_hole)
  par_per_hole  int[]  not null,              -- 18 elements, e.g. [4,4,3,...]
  hole_type     text[] not null,              -- 18 elements: 'par3'|'par4'|'par5'
  yardage       int[]  not null,              -- 18 elements
  stroke_index  int[]  not null,              -- USGA stroke allocation 1-18 (1=hardest)
  created_at    timestamptz not null default now(),
  constraint courses_array_lengths check (
    array_length(par_per_hole, 1) = 18 and
    array_length(hole_type, 1)    = 18 and
    array_length(yardage, 1)      = 18 and
    array_length(stroke_index, 1) = 18
  )
);

-- Events
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references public.leagues(id) on delete cascade,
  course_id      uuid not null references public.courses(id),
  event_date     date not null,
  event_number   int  not null,
  entry_fee      numeric(10,2) not null default 0,
  status         text not null default 'upcoming'
                   check (status in ('upcoming', 'active', 'complete')),
  payout_config  jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

-- Players (global roster)
create table public.players (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  email        text unique,
  ghin_number  text,
  created_at   timestamptz not null default now()
);

-- Event roster + computed fields
create table public.event_players (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid not null references public.events(id) on delete cascade,
  player_id                uuid not null references public.players(id) on delete cascade,
  handicap_index           numeric(4,1) not null,
  course_handicap          int,
  flight                   text check (flight in ('A', 'B')),
  tournament_wins_prior    int  not null default 0,
  adjusted_handicap_index  numeric(4,1),
  is_scorekeeper           bool not null default false,
  group_number             int,
  created_at               timestamptz not null default now(),
  unique(event_id, player_id)
);

-- Hole-by-hole scores
create table public.scores (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  hole_number  int  not null check (hole_number between 1 and 18),
  gross_score  int  not null check (gross_score > 0),
  putts        int       check (putts >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(event_id, player_id, hole_number)
);

-- Manual side game results
create table public.side_games (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  game_type         text not null check (game_type in ('long_drive', 'ctp', 'low_putts')),
  hole_number       int,    -- relevant for CTP
  winner_player_id  uuid references public.players(id),
  value             numeric(10,2),
  flight            text check (flight in ('A', 'B', 'overall')),
  created_at        timestamptz not null default now()
);

-- Skins results (computed at event close, stored per hole per flight)
create table public.skins (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  hole_number       int  not null check (hole_number between 1 and 18),
  flight            text not null check (flight in ('A', 'B')),
  winner_player_id  uuid references public.players(id),  -- null = tied/carryover
  is_carryover      bool not null default false,
  resolved          bool not null default false,
  skins_count       int  not null default 1,             -- includes carryover
  created_at        timestamptz not null default now()
);

-- Season earnings ledger (excludes skins per spec)
create table public.season_earnings (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  category    text not null,
  amount      numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_events_league_id         on public.events(league_id);
create index idx_events_status            on public.events(status);
create index idx_event_players_event_id   on public.event_players(event_id);
create index idx_event_players_player_id  on public.event_players(player_id);
create index idx_scores_event_id          on public.scores(event_id);
create index idx_scores_event_player      on public.scores(event_id, player_id);
create index idx_scores_event_hole        on public.scores(event_id, hole_number);
create index idx_skins_event_id           on public.skins(event_id);
create index idx_skins_event_flight       on public.skins(event_id, flight);
create index idx_season_earnings_league   on public.season_earnings(league_id);
create index idx_season_earnings_player   on public.season_earnings(player_id);
create index idx_profiles_player_id       on public.profiles(player_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.leagues         enable row level security;
alter table public.courses         enable row level security;
alter table public.events          enable row level security;
alter table public.players         enable row level security;
alter table public.event_players   enable row level security;
alter table public.scores          enable row level security;
alter table public.side_games      enable row level security;
alter table public.skins           enable row level security;
alter table public.season_earnings enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function public.is_admin()
returns bool
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Returns true if the current user is a scorekeeper assigned to the given event
create or replace function public.is_scorekeeper_for_event(p_event_id uuid)
returns bool
language sql security definer stable
as $$
  select exists (
    select 1
    from public.event_players ep
    join public.profiles pr on pr.player_id = ep.player_id
    where ep.event_id = p_event_id
      and ep.is_scorekeeper = true
      and pr.id = auth.uid()
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
create policy "Own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "Own profile update" on public.profiles for update using (auth.uid() = id);
create policy "Admin all profiles" on public.profiles for all    using (public.is_admin());
create policy "Insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- leagues (read for all auth, write for admin)
create policy "Auth read leagues"   on public.leagues for select using (auth.role() = 'authenticated');
create policy "Admin write leagues" on public.leagues for all    using (public.is_admin());

-- courses
create policy "Auth read courses"   on public.courses for select using (auth.role() = 'authenticated');
create policy "Admin write courses" on public.courses for all    using (public.is_admin());

-- events
create policy "Auth read events"   on public.events for select using (auth.role() = 'authenticated');
create policy "Admin write events" on public.events for all    using (public.is_admin());

-- players
create policy "Auth read players"   on public.players for select using (auth.role() = 'authenticated');
create policy "Admin write players" on public.players for all    using (public.is_admin());

-- event_players
create policy "Auth read event_players"   on public.event_players for select using (auth.role() = 'authenticated');
create policy "Admin write event_players" on public.event_players for all    using (public.is_admin());

-- scores: anyone auth can read; scorekeepers or admins can write
create policy "Auth read scores"              on public.scores for select using (auth.role() = 'authenticated');
create policy "Scorekeeper or admin insert"   on public.scores for insert with check (
  public.is_admin() or public.is_scorekeeper_for_event(event_id)
);
create policy "Scorekeeper or admin update"   on public.scores for update using (
  public.is_admin() or public.is_scorekeeper_for_event(event_id)
);
create policy "Admin delete scores"           on public.scores for delete using (public.is_admin());

-- side_games
create policy "Auth read side_games"   on public.side_games for select using (auth.role() = 'authenticated');
create policy "Admin write side_games" on public.side_games for all    using (public.is_admin());

-- skins
create policy "Auth read skins"   on public.skins for select using (auth.role() = 'authenticated');
create policy "Admin write skins" on public.skins for all    using (public.is_admin());

-- season_earnings
create policy "Auth read season_earnings"   on public.season_earnings for select using (auth.role() = 'authenticated');
create policy "Admin write season_earnings" on public.season_earnings for all    using (public.is_admin());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'scorekeeper'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update scores.updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scores_updated_at
  before update on public.scores
  for each row execute function public.set_updated_at();

-- ============================================================
-- REALTIME
-- ============================================================

alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.skins;
alter publication supabase_realtime add table public.event_players;
alter publication supabase_realtime add table public.side_games;
