-- 0003_public_profiles.sql
--
-- Public player profiles: /u/<handle>, with stats, an activity heatmap and the cosmetic
-- loadout. Three things were missing before any of that could be built:
--
--   1. A PUBLIC IDENTIFIER. `kinetype.leaderboard()` already hands out `user_id`, i.e. every
--      player's auth UUID. Putting that in a profile URL would spread an auth identifier
--      around the web, so profiles are addressed by a separate, cosmetic `handle` instead.
--      The handle is derived once, is unique, and never changes (so shared links keep working).
--
--   2. A PUBLIC READ PATH. After 0002 the profiles table is own-row only and anon has no SELECT
--      at all, so a profile page cannot read the table. Everything public goes through
--      SECURITY DEFINER functions that hand back an explicit column list.
--
--   3. PERSISTED COSMETICS. Skins and themes lived only in localStorage, so nobody else could
--      ever see them. They are now stored on the profile.
--
-- VISIBILITY: a profile is public exactly while `show_on_leaderboard` is true. That keeps one
-- privacy switch rather than two, and means the only people whose profile is reachable are the
-- ones who already chose to appear publicly. Flipping this to opt-in-by-link is a one-line change
-- in public_profile() and match_activity().

-- ------------------------------------------------------------------- slugify()
-- Lowercase, non-alphanumerics to single dashes, trimmed. Returns '' when nothing survives.
create or replace function kinetype.slugify(p_text text)
returns text
language sql immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'),
          '-{2,}', '-', 'g'
        )
      ),
      ''
    ),
    ''
  );
$$;

-- ---------------------------------------------------------------- assign_handle()
-- One-time derivation, stable for the life of the profile. Prefers the provider username
-- (Google's `preferred_username`) because it is already handle-shaped, then the display name.
-- Falls back to a slice of the uuid when a name slugifies to nothing useful, and disambiguates
-- collisions with a numeric suffix rather than silently sharing a handle.
create or replace function kinetype.assign_handle(
  p_display_name text,
  p_username     text,
  p_uid          uuid
) returns text
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_base text;
  v_cand text;
  v_n    integer := 1;
begin
  v_base := kinetype.slugify(coalesce(nullif(p_username, ''), nullif(p_display_name, ''), 'player'));
  v_base := left(v_base, 20);
  if length(v_base) < 3 then
    v_base := 'player-' || substr(replace(p_uid::text, '-', ''), 1, 6);
  end if;

  v_cand := v_base;
  while exists (
    select 1 from kinetype.profiles p
    where p.handle = v_cand and p.id <> p_uid
  ) loop
    v_n := v_n + 1;
    v_cand := v_base || '-' || v_n::text;
  end loop;

  return v_cand;
end $$;

-- ------------------------------------------------------------------- new columns
alter table kinetype.profiles add column if not exists handle text;

-- The loadout. Self-reported, deliberately: coins and purchases are decided in the browser
-- (game/storage.ts), so there is no server-side truth to check these against. They are cosmetic,
-- validated for shape and capped in length, and never touch XP or the leaderboard.
alter table kinetype.profiles add column if not exists equipped_skin  text   not null default 'spark';
alter table kinetype.profiles add column if not exists equipped_theme text   not null default 'paper';
alter table kinetype.profiles add column if not exists owned_skins    text[] not null default array['spark'];
alter table kinetype.profiles add column if not exists owned_themes   text[] not null default array['paper'];

-- Backfill the players who signed up before handles existed.
update kinetype.profiles
   set handle = kinetype.assign_handle(display_name, username, id)
 where handle is null;

alter table kinetype.profiles alter column handle set not null;
create unique index if not exists kt_profiles_handle_key on kinetype.profiles (handle);

-- --------------------------------------------------------------- ensure_profile()
-- Replaced to mint the handle on first sign-in. The handle is set on INSERT and never on
-- conflict: it is the profile's public address, so it must not move under a shared link.
create or replace function kinetype.ensure_profile()
returns kinetype.profiles
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  kinetype.profiles;
  v_user text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select nullif(u.raw_user_meta_data->>'preferred_username', ''),
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''),
                  nullif(u.raw_user_meta_data->>'name', ''),
                  split_part(coalesce(u.email, 'player'), '@', 1),
                  'player')
    into v_user, v_name
  from auth.users u
  where u.id = v_uid;

  insert into kinetype.profiles (id, handle, username, display_name, avatar_url)
  select v_uid,
         kinetype.assign_handle(coalesce(v_name, 'player'), v_user, v_uid),
         v_user,
         coalesce(v_name, 'player'),
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

-- --------------------------------------------------------------- public_profile()
-- Everything a profile page is allowed to show, by handle. Explicit column list: the table holds
-- `username`, `show_on_leaderboard` and `updated_at` too, and none of those belong on a public
-- page. Returns nothing for an unknown handle OR a player who hid from the leaderboard, so the
-- two are indistinguishable and a hidden profile cannot be probed for.
create or replace function kinetype.public_profile(p_handle text)
returns table (
  handle         text,
  display_name   text,
  avatar_url     text,
  xp             bigint,
  level          integer,
  best_wpm       numeric,
  best_accuracy  numeric,
  matches        integer,
  wins           integer,
  losses         integer,
  best_streak    integer,
  bosses_cleared integer,
  equipped_skin  text,
  equipped_theme text,
  owned_skins    text[],
  owned_themes   text[],
  joined         timestamptz
)
language sql stable security definer set search_path = kinetype, public
as $$
  select p.handle, p.display_name, p.avatar_url,
         p.xp::bigint, p.level, p.best_wpm, p.best_accuracy,
         p.matches, p.wins, p.losses, p.best_streak,
         p.bosses_cleared, p.equipped_skin, p.equipped_theme,
         p.owned_skins, p.owned_themes, p.created_at
  from kinetype.profiles p
  where p.handle = kinetype.slugify(p_handle)
    and p.show_on_leaderboard
  limit 1;
$$;

grant execute on function kinetype.public_profile(text) to anon, authenticated;

-- --------------------------------------------------------------- match_activity()
-- Per-day aggregates for the heatmap. Only days WITH activity are returned; the client fills
-- the gaps so the grid stays continuous and the server does no sparsifying. p_days is clamped
-- to a year plus change — one GitHub-style grid needs 371.
create or replace function kinetype.match_activity(p_handle text, p_days integer default 371)
returns table (
  day     date,
  matches integer,
  wins    integer,
  xp      bigint
)
language sql stable security definer set search_path = kinetype, public
as $$
  with me as (
    select p.id
    from kinetype.profiles p
    where p.handle = kinetype.slugify(p_handle)
      and p.show_on_leaderboard
    limit 1
  ),
  span as (
    select ((now() at time zone 'utc')::date
             - least(greatest(coalesce(p_days, 371), 1), 400)) as since_day
  )
  select (m.created_at at time zone 'utc')::date  as day,
         count(*)::integer                        as matches,
         count(*) filter (where m.won)::integer   as wins,
         coalesce(sum(m.xp_awarded), 0)::bigint   as xp
  from kinetype.matches m
  cross join me
  cross join span
  where m.user_id = me.id
    and (m.created_at at time zone 'utc')::date >= span.since_day
  group by 1
  order by 1;
$$;

grant execute on function kinetype.match_activity(text, integer) to anon, authenticated;

-- ------------------------------------------------------------------ set_loadout()
-- Stores the caller's cosmetics. Ids are shape-checked, de-duplicated, ordered and capped, and
-- the equipped skin/theme is force-added to the owned set so a profile can never advertise an
-- equip its owner does not own. Self-reported by design: coins and purchases are decided in the
-- browser, so there is no server-side truth to validate against — see the column comment above.
create or replace function kinetype.set_loadout(
  p_skin         text,
  p_theme        text,
  p_owned_skins  text[],
  p_owned_themes text[]
) returns void
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_uid   uuid := auth.uid();
  v_ok    text := '^[a-z0-9][a-z0-9-]{0,31}$';
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update kinetype.profiles
     set equipped_skin  = case when p_skin  ~ v_ok then p_skin  else equipped_skin  end,
         equipped_theme = case when p_theme ~ v_ok then p_theme else equipped_theme end,
         owned_skins = (
           select coalesce(array_agg(distinct s order by s), array[]::text[])
           from (
             select s
             from unnest(
               coalesce(p_owned_skins, array[]::text[])
               || array[(case when p_skin ~ v_ok then p_skin else 'spark' end)]
             ) s
             where s ~ v_ok
             order by s
             limit 64
           ) t
         ),
         owned_themes = (
           select coalesce(array_agg(distinct s order by s), array[]::text[])
           from (
             select s
             from unnest(
               coalesce(p_owned_themes, array[]::text[])
               || array[(case when p_theme ~ v_ok then p_theme else 'paper' end)]
             ) s
             where s ~ v_ok
             order by s
             limit 64
           ) t
         ),
         updated_at = now()
   where id = v_uid;
end $$;

grant execute on function kinetype.set_loadout(text, text, text[], text[]) to authenticated;

-- ------------------------------------------------------------------- leaderboard()
-- Redefined to return `handle` instead of `user_id`. The board was handing out every player's
-- auth UUID; a public ranking has no need to publish an auth identifier, and profiles are now
-- addressed by handle. `is_me` is what marks the caller's own row.
-- A changed return type cannot be replaced in place, hence the drop.
drop function if exists kinetype.leaderboard(text, integer);
create function kinetype.leaderboard(
  p_window text default 'overall',
  p_limit  integer default 50
) returns table (
  rank            integer,
  handle          text,
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
    select p.id as user_id, p.handle, p.display_name, p.avatar_url,
           case when p_window = 'overall' then p.xp::bigint else coalesce(a.xp_sum, 0) end as xp,
           p.level, p.best_wpm, p.bosses_cleared
    from kinetype.profiles p
    left join agg a on a.user_id = p.id
    where p.show_on_leaderboard
  )
  select (row_number() over (order by b.xp desc, b.best_wpm desc, b.display_name))::integer,
         b.handle, b.display_name, b.avatar_url, b.xp, b.level, b.best_wpm, b.bosses_cleared,
         (b.user_id = auth.uid())
  from base b
  where b.xp > 0
  order by b.xp desc, b.best_wpm desc, b.display_name
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function kinetype.leaderboard(text, integer) to anon, authenticated;

