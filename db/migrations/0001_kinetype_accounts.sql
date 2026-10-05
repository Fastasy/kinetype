-- Kinetype — accounts, progression, boss campaign, leaderboards.
--
-- Hosted in a dedicated `kinetype` schema inside an EXISTING Supabase project
-- (Supabase free plan caps an account at 2 active projects; no 3rd project is
-- available, so we isolate by schema and migrate to a dedicated project later).
--
-- Conventions:
--   * Everything is idempotent — this file is safe to re-run.
--   * Streakly's `public` schema is never touched.
--   * Server-authoritative XP: the client cannot inflate its own score.
--   * All writes go through SECURITY DEFINER functions; tables are RLS-locked.
--
-- XP formula MIRRORS game/progression.ts:xForMatch() ONE-FOR-ONE.
-- If you change one, change the other. game/tests/progression.test.ts pins the
-- TypeScript side and this file's equation is asserted to match it.

create schema if not exists kinetype;

-- --------------------------------------------------------------------- profiles
create table if not exists kinetype.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text,
  display_name        text,
  avatar_url          text,
  xp                  integer     not null default 0 check (xp >= 0),
  best_wpm            numeric     not null default 0,
  best_accuracy       numeric     not null default 0,
  matches             integer     not null default 0,
  wins                integer     not null default 0,
  losses              integer     not null default 0,
  current_streak      integer     not null default 0,
  best_streak         integer     not null default 0,
  bosses_cleared      integer     not null default 0,
  show_on_leaderboard boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Level is DERIVED, never stored by hand: floor(sqrt(xp / 100)) + 1.
-- Reuses the curve the old Kinetype typing site shipped, so the number means the
-- same thing to anyone who saw it before. Kept as a generated column so the two
-- sides of the leaderboard cannot disagree about someone's level.
alter table kinetype.profiles
  add column if not exists level integer
  generated always as ((floor(sqrt(xp::numeric / 100.0)))::integer + 1) stored;

-- ---------------------------------------------------------------------- matches
create table if not exists kinetype.matches (
  id          bigserial primary key,
  user_id     uuid not null references kinetype.profiles(id) on delete cascade,
  mode        text not null default 'free' check (mode in ('free','boss')),
  boss_id     text,
  bot_wpm     integer not null default 40,
  won         boolean not null default false,
  wpm         numeric not null default 0,
  accuracy    numeric not null default 0,
  best_combo  integer not null default 0,
  rounds_won  integer not null default 0,
  rounds_lost integer not null default 0,
  xp_awarded  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists kt_matches_user_created_idx on kinetype.matches (user_id, created_at desc);
create index if not exists kt_matches_created_idx      on kinetype.matches (created_at desc);

-- ------------------------------------------------------------------ boss clears
create table if not exists kinetype.boss_clears (
  user_id    uuid not null references kinetype.profiles(id) on delete cascade,
  boss_id    text not null,
  cleared_at timestamptz not null default now(),
  attempts   integer not null default 1,
  primary key (user_id, boss_id)
);

-- --------------------------------------------------------------- ensure_profile()
-- Idempotent: creates the profile row on first login and refreshes OAuth profile
-- fields afterwards. Called by the client right after sign-in, so it works for any
-- provider (a signup trigger cannot read Google metadata reliably).
create or replace function kinetype.ensure_profile()
returns kinetype.profiles
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into kinetype.profiles (id, username, display_name, avatar_url)
  select v_uid,
         nullif(u.raw_user_meta_data->>'preferred_username', ''),
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''),
                  nullif(u.raw_user_meta_data->>'name', ''),
                  split_part(coalesce(u.email, 'player'), '@', 1)),
         nullif(u.raw_user_meta_data->>'avatar_url', '')
  from auth.users u
  where u.id = v_uid
  on conflict (id) do update
    set display_name = coalesce(kinetype.profiles.display_name, excluded.display_name),
        avatar_url   = coalesce(kinetype.profiles.avatar_url,   excluded.avatar_url),
        updated_at   = now();

  select * into v_row from kinetype.profiles where id = v_uid;
  return v_row;
end $$;

-- ------------------------------------------------------------------ xp_for_match()
-- Pure, immutable, and the ONLY place XP is decided. Inputs are clamped so a
-- tampered payload cannot inflate a score. See the mirror in game/progression.ts.
create or replace function kinetype.xp_for_match(
  p_won          boolean,
  p_rounds_won   integer,
  p_wpm          numeric,
  p_accuracy     numeric,
  p_streak       integer,
  p_mode         text,
  p_boss_cleared boolean
) returns integer
language sql immutable
as $$
  select greatest(0,
      (case when p_won then 40 else 12 end)
    + least(5, greatest(0, p_rounds_won)) * 10
    + round(least(400, greatest(0, p_wpm))::numeric * 0.6)
    + round(least(100, greatest(0, p_accuracy))::numeric / 100.0 * 30)
    + least(5, greatest(0, p_streak)) * 8
    + (case when p_mode = 'boss' then 60 else 0 end)
    + (case when p_boss_cleared then 140 else 0 end)
  )::integer;
$$;

-- --------------------------------------------------------------------- submit_match()
-- One atomic write per finished match: record it, award XP, update aggregate
-- stats, and register a boss first-clear. Returns the updated profile.
create or replace function kinetype.submit_match(
  p_mode        text,
  p_boss_id     text,
  p_bot_wpm     integer,
  p_won         boolean,
  p_wpm         numeric,
  p_accuracy    numeric,
  p_best_combo  integer,
  p_rounds_won  integer,
  p_rounds_lost integer,
  p_streak      integer
) returns kinetype.profiles
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_uid        uuid := auth.uid();
  v_first      boolean := false;
  v_xp         integer;
  v_row        kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform kinetype.ensure_profile();

  if p_mode = 'boss' and p_boss_id is not null and coalesce(p_won, false) then
    select not exists (
      select 1 from kinetype.boss_clears b
      where b.user_id = v_uid and b.boss_id = p_boss_id
    ) into v_first;
  end if;

  v_xp := kinetype.xp_for_match(
    coalesce(p_won, false), coalesce(p_rounds_won, 0), coalesce(p_wpm, 0),
    coalesce(p_accuracy, 0), coalesce(p_streak, 0), coalesce(p_mode, 'free'), v_first);

  insert into kinetype.matches
    (user_id, mode, boss_id, bot_wpm, won, wpm, accuracy, best_combo, rounds_won, rounds_lost, xp_awarded)
  values
    (v_uid, coalesce(p_mode, 'free'), p_boss_id, coalesce(p_bot_wpm, 40),
     coalesce(p_won, false), coalesce(p_wpm, 0), coalesce(p_accuracy, 0),
     coalesce(p_best_combo, 0), coalesce(p_rounds_won, 0), coalesce(p_rounds_lost, 0), v_xp);

  if p_mode = 'boss' and p_boss_id is not null and coalesce(p_won, false) then
    insert into kinetype.boss_clears (user_id, boss_id)
    values (v_uid, p_boss_id)
    on conflict (user_id, boss_id) do update
      set attempts = kinetype.boss_clears.attempts + 1;
  end if;

  update kinetype.profiles p set
    xp            = p.xp + v_xp,
    matches       = p.matches + 1,
    wins          = p.wins   + (case when coalesce(p_won, false) then 1 else 0 end),
    losses        = p.losses + (case when coalesce(p_won, false) then 0 else 1 end),
    best_wpm      = greatest(p.best_wpm,      coalesce(p_wpm, 0)),
    best_accuracy = greatest(p.best_accuracy, coalesce(p_accuracy, 0)),
    current_streak = case when coalesce(p_won, false) then greatest(0, coalesce(p_streak, 0)) else 0 end,
    best_streak    = greatest(p.best_streak, coalesce(p_streak, 0)),
    bosses_cleared = (select count(*) from kinetype.boss_clears bc where bc.user_id = v_uid),
    updated_at    = now()
  where p.id = v_uid;

  select * into v_row from kinetype.profiles where id = v_uid;
  return v_row;
end $$;

-- --------------------------------------------------------------------- leaderboard()
-- Board metric is XP/level (Ruan's call), in three windows.
--   daily  -> since 00:00 UTC today
--   weekly -> since Monday 00:00 UTC (ISO week)
--   overall-> lifetime XP
-- SECURITY DEFINER so anon can read the public board without table grants.
create or replace function kinetype.leaderboard(
  p_window text default 'overall',
  p_limit  integer default 50
) returns table (
  rank            integer,
  user_id         uuid,
  display_name    text,
  avatar_url      text,
  xp              bigint,
  level           integer,
  best_wpm        numeric,
  bosses_cleared  integer,
  is_me           boolean
)
language sql stable security definer set search_path = kinetype, public
as $$
  with win as (
    select case
             when p_window = 'daily'  then date_trunc('day',  now() at time zone 'utc') at time zone 'utc'
             when p_window = 'weekly' then date_trunc('week', now() at time zone 'utc') at time zone 'utc'
             else to_timestamp(0)
           end as since
  ),
  agg as (
    select m.user_id, sum(m.xp_awarded)::bigint as xp_sum
    from kinetype.matches m, win
    where p_window = 'overall' or m.created_at >= win.since
    group by m.user_id
  ),
  base as (
    select p.id as user_id, p.display_name, p.avatar_url,
           case when p_window = 'overall' then p.xp::bigint else coalesce(a.xp_sum, 0) end as xp,
           p.level, p.best_wpm, p.bosses_cleared
    from kinetype.profiles p
    left join agg a on a.user_id = p.id
    where p.show_on_leaderboard
  )
  select (row_number() over (order by b.xp desc, b.best_wpm desc, b.display_name))::integer,
         b.user_id, b.display_name, b.avatar_url, b.xp, b.level, b.best_wpm, b.bosses_cleared,
         (b.user_id = auth.uid())
  from base b
  where b.xp > 0
  order by b.xp desc, b.best_wpm desc, b.display_name
  limit least(greatest(p_limit, 1), 200);
$$;

-- ------------------------------------------------------------------------- RLS
alter table kinetype.profiles     enable row level security;
alter table kinetype.matches      enable row level security;
alter table kinetype.boss_clears  enable row level security;

drop policy if exists kt_profiles_select on kinetype.profiles;
create policy kt_profiles_select on kinetype.profiles for select using (true);
drop policy if exists kt_profiles_insert on kinetype.profiles;
create policy kt_profiles_insert on kinetype.profiles for insert with check (auth.uid() = id);
drop policy if exists kt_profiles_update on kinetype.profiles;
create policy kt_profiles_update on kinetype.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists kt_matches_select on kinetype.matches;
create policy kt_matches_select on kinetype.matches for select using (auth.uid() = user_id);
drop policy if exists kt_matches_insert on kinetype.matches;
create policy kt_matches_insert on kinetype.matches for insert with check (auth.uid() = user_id);

drop policy if exists kt_clears_select on kinetype.boss_clears;
create policy kt_clears_select on kinetype.boss_clears for select using (auth.uid() = user_id);
drop policy if exists kt_clears_insert on kinetype.boss_clears;
create policy kt_clears_insert on kinetype.boss_clears for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------- grants
grant usage on schema kinetype to anon, authenticated;
grant select on kinetype.profiles to anon, authenticated;
grant select, insert, update on kinetype.profiles    to authenticated;
grant select, insert         on kinetype.matches     to authenticated;
grant select, insert         on kinetype.boss_clears to authenticated;
grant usage, select on all sequences in schema kinetype to authenticated;

grant execute on function kinetype.ensure_profile()                                to authenticated;
grant execute on function kinetype.submit_match(text,text,integer,boolean,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function kinetype.leaderboard(text,integer)                       to anon, authenticated;
