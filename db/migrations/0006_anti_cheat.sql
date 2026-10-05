-- 0006_anti_cheat.sql
--
-- Two problems, and only the first one is the reported bug.
--
-- 1. THE DOOR WAS OPEN. An ordinary signed-in player could PATCH their own kinetype.profiles row
--    straight through PostgREST. RLS said the row had to be THEIRS; nothing said what could be
--    WRITTEN to it. Measured against the live project: a brand-new account with zero matches, one
--    request, `{"xp": 999999}` -> rank 1 on the leaderboard. No match played, no throttle, no
--    formula, nothing to detect afterwards except that the number was large.
--
--    Migration 0002 hardened the READ side (own-row select, anon revoked) and left every WRITE
--    policy in place, because all writes were *supposed* to go through an RPC. That is a
--    convention, not a control. Revoking the direct writes is what makes the RPCs the only door.
--    It costs the app nothing: the RPCs are SECURITY DEFINER, so they do not need the caller to
--    hold a table privilege. The same hole existed on `matches` (forge match rows to inflate the
--    daily/weekly boards, which SUM xp_awarded) and on `boss_clears` (fake clears, which
--    submit_match then re-counts into bosses_cleared).
--
-- 2. THE RPC WAS TOO TRUSTING. With the door shut, a forged submit_match is still possible — it
--    was always the honest statement that a client-simulated match cannot be proven. So refuse
--    what the game's own rules make impossible, and record (without paying) what only a script
--    produces.
--
-- WHAT IS DELIBERATELY NOT HERE: deleting anything, and banning anyone. A flagged match stays
-- recorded with its reason, a flagged account keeps playing, and 3 flags only makes it UNRANKED
-- until a human looks. A false positive costs a ranking, never an account, and clearing it is one
-- UPDATE (see the bottom of this file).
--
-- NOT DETECTABLE, and worth saying out loud: a forged match that is internally PLAUSIBLE — a
-- believable wpm and accuracy, submitted at a believable rate — cannot be told apart from a real
-- one by anything the server is told. Real anti-cheat needs server-side simulation or input replay.
-- This migration bounds the damage and makes bulk farming and free XP impossible; it does not
-- make the board cheat-proof.

-- ============================================================================ 1. close the door

revoke insert, update, delete on kinetype.profiles     from anon, authenticated, public;
revoke insert, update, delete on kinetype.matches      from anon, authenticated, public;
revoke insert, update, delete on kinetype.boss_clears  from anon, authenticated, public;

-- The policies are unreachable now, and leaving them invites someone to re-grant the privilege
-- "because the policy is there". Drop them so the intent cannot be misread.
drop policy if exists kt_profiles_insert on kinetype.profiles;
drop policy if exists kt_profiles_update on kinetype.profiles;
drop policy if exists kt_matches_insert  on kinetype.matches;
drop policy if exists kt_clears_insert   on kinetype.boss_clears;

-- SELECT is untouched on purpose: getProfile() and getClearedBosses() read the caller's own rows
-- (kt_profiles_select_own, kt_matches_select, kt_clears_select).

-- ============================================================== 2. somewhere to record a refusal

alter table kinetype.profiles add column if not exists flags        integer     not null default 0;
alter table kinetype.profiles add column if not exists last_flag_at timestamptz;
alter table kinetype.matches  add column if not exists flag_reason  text;

comment on column kinetype.profiles.flags is
  'Implausible submissions seen. At 3 the account is UNRANKED until a human clears it; it can still play.';
comment on column kinetype.matches.flag_reason is
  'Why this match was not paid. NULL on every honest match; the audit trail for the others.';

create index if not exists kt_profiles_flags_idx on kinetype.profiles (flags);

-- ================================================== 3. submit_match: refuse, and refuse to pay

create or replace function kinetype.submit_match(
  p_mode text, p_boss_id text, p_bot_wpm integer, p_won boolean, p_wpm numeric,
  p_accuracy numeric, p_best_combo integer, p_rounds_won integer, p_rounds_lost integer, p_streak integer
)
returns kinetype.profiles
language plpgsql
security definer
set search_path to 'kinetype', 'public'
as $function$
declare
  C_MAX_MATCHES_PER_MIN constant integer := 12;
  C_DAILY_XP_CAP        constant integer := 25000;
  -- Set well above any legitimate result rather than just above the current best. The fastest
  -- honest match on the live board is 128 wpm, and no human sustains 200 in a typing fight.
  C_SUSPICIOUS_WPM      constant integer := 200;
  -- Above this it is not "implausible", it is impossible: nobody types 320 wpm, and the value is
  -- only reachable by constructing the payload. Refused outright rather than recorded.
  C_IMPOSSIBLE_WPM      constant integer := 320;
  -- A match cannot be completed in five seconds: rounds carry countdowns and the bot has to push
  -- you off a platform. Anything faster was not played.
  C_MIN_GAP_SECONDS     constant integer := 5;

  v_uid       uuid := auth.uid();
  v_first     boolean := false;
  v_boss_pay  integer := 0;
  v_xp        integer;
  v_coins     integer;
  v_recent    integer;
  v_today_xp  integer;
  v_last      timestamptz;
  v_flag      text := null;
  v_row       kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform kinetype.ensure_profile();

  -- ---- refuse what the rules make impossible. These are not judgement calls, so they cost an
  -- ---- honest client exactly nothing and a forger everything.
  if coalesce(p_rounds_won, 0) < 0 or coalesce(p_rounds_lost, 0) < 0
     or coalesce(p_rounds_won, 0) + coalesce(p_rounds_lost, 0) > 5 then
    raise exception 'That match result is not possible.' using errcode = 'P0001';
  end if;

  if coalesce(p_won, false) and coalesce(p_rounds_won, 0) < 1 then
    raise exception 'A match cannot be won without winning a round.' using errcode = 'P0001';
  end if;

  if coalesce(p_accuracy, 0) < 0 or coalesce(p_accuracy, 0) > 100 or coalesce(p_wpm, 0) < 0 then
    raise exception 'That match result is not possible.' using errcode = 'P0001';
  end if;

  if coalesce(p_wpm, 0) > C_IMPOSSIBLE_WPM then
    raise exception 'That typing speed is not physically possible.' using errcode = 'P0001';
  end if;

  if coalesce(p_mode, 'free') not in ('free', 'boss') then
    raise exception 'Unknown match mode.' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from kinetype.matches m
  where m.user_id = v_uid and m.created_at > now() - interval '60 seconds';

  if v_recent >= C_MAX_MATCHES_PER_MIN then
    raise exception 'Too many matches submitted at once. Wait a moment and try again.'
      using errcode = 'P0001';
  end if;

  -- ---- flag what only a script produces. The match is still recorded, so nothing is hidden;
  -- ---- it just does not pay.
  select max(m.created_at) into v_last from kinetype.matches m where m.user_id = v_uid;

  if coalesce(p_wpm, 0) > C_SUSPICIOUS_WPM then
    v_flag := format('typing speed of %s wpm', round(coalesce(p_wpm, 0)));
  elsif coalesce(p_accuracy, 0) >= 100 and coalesce(p_wpm, 0) > 150 then
    v_flag := format('perfect accuracy at %s wpm', round(coalesce(p_wpm, 0)));
  elsif v_last is not null and now() - v_last < make_interval(secs => C_MIN_GAP_SECONDS) then
    v_flag := format('submitted %s seconds after the previous match',
                     round(extract(epoch from (now() - v_last))));
  end if;

  if p_mode = 'boss' and p_boss_id is not null and coalesce(p_won, false) then
    select not exists (
      select 1 from kinetype.boss_clears b
      where b.user_id = v_uid and b.boss_id = p_boss_id
    ) into v_first;
    if v_first then
      select coalesce(br.coins, 0) into v_boss_pay
      from kinetype.boss_rewards br where br.boss_id = p_boss_id;
      v_boss_pay := coalesce(v_boss_pay, 0);
    end if;
  end if;

  v_xp := kinetype.xp_for_match(
    coalesce(p_won, false), coalesce(p_rounds_won, 0), coalesce(p_wpm, 0),
    coalesce(p_accuracy, 0), coalesce(p_streak, 0), coalesce(p_mode, 'free'), v_first);

  v_coins := kinetype.coins_for_match(
    coalesce(p_won, false), coalesce(p_rounds_won, 0), coalesce(p_wpm, 0),
    coalesce(p_accuracy, 0), coalesce(p_streak, 0)) + v_boss_pay;

  -- A flagged match pays nothing. Subtracting the bounty here as well is what stops a forged
  -- first-clear being used to mint coins.
  if v_flag is not null then
    v_xp    := 0;
    v_coins := 0;
  end if;

  select coalesce(sum(m.xp_awarded), 0) into v_today_xp
  from kinetype.matches m
  where m.user_id = v_uid
    and m.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_today_xp >= C_DAILY_XP_CAP then
    v_xp    := 0;
    v_coins := 0;
  end if;

  insert into kinetype.matches
    (user_id, mode, boss_id, bot_wpm, won, wpm, accuracy, best_combo, rounds_won, rounds_lost,
     xp_awarded, flag_reason)
  values
    (v_uid, coalesce(p_mode, 'free'), p_boss_id, coalesce(p_bot_wpm, 40),
     coalesce(p_won, false), coalesce(p_wpm, 0), coalesce(p_accuracy, 0),
     coalesce(p_best_combo, 0), coalesce(p_rounds_won, 0), coalesce(p_rounds_lost, 0), v_xp, v_flag);

  -- A flagged submission must not claim a boss clear either, or a script can unlock the ladder.
  if p_mode = 'boss' and p_boss_id is not null and coalesce(p_won, false) and v_flag is null then
    insert into kinetype.boss_clears (user_id, boss_id)
    values (v_uid, p_boss_id)
    on conflict (user_id, boss_id) do update
      set attempts = kinetype.boss_clears.attempts + 1;
  end if;

  update kinetype.profiles p set
    xp            = p.xp + v_xp,
    coins         = p.coins + v_coins,
    matches       = p.matches + 1,
    wins          = p.wins   + (case when coalesce(p_won, false) then 1 else 0 end),
    losses        = p.losses + (case when coalesce(p_won, false) then 0 else 1 end),
    best_wpm      = greatest(p.best_wpm,      coalesce(p_wpm, 0)),
    best_accuracy = greatest(p.best_accuracy, coalesce(p_accuracy, 0)),
    current_streak = case when coalesce(p_won, false) then greatest(0, coalesce(p_streak, 0)) else 0 end,
    best_streak    = greatest(p.best_streak, coalesce(p_streak, 0)),
    bosses_cleared = (select count(*) from kinetype.boss_clears bc where bc.user_id = v_uid),
    flags          = p.flags + (case when v_flag is null then 0 else 1 end),
    last_flag_at   = case when v_flag is null then p.last_flag_at else now() end,
    updated_at    = now()
  where p.id = v_uid;

  select * into v_row from kinetype.profiles where id = v_uid;
  return v_row;
end $function$;

-- ============================================== 4. the board does not rank flagged accounts

create or replace function kinetype.leaderboard(p_window text default 'overall', p_limit integer default 50)
returns table(rank integer, handle text, display_name text, avatar_url text, xp bigint,
              level integer, best_wpm numeric, bosses_cleared integer, is_me boolean)
language sql
stable security definer
set search_path to 'kinetype', 'public'
as $function$
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
    -- Unranked, not banned: 3 flags is a review queue, and one UPDATE puts them back.
    where p.show_on_leaderboard and p.flags < 3
  )
  select (row_number() over (order by b.xp desc, b.best_wpm desc, b.display_name))::integer,
         b.handle, b.display_name, b.avatar_url, b.xp, b.level, b.best_wpm, b.bosses_cleared,
         (b.user_id = auth.uid())
  from base b
  where b.xp > 0
  order by b.xp desc, b.best_wpm desc, b.display_name
  limit least(greatest(p_limit, 1), 200);
$function$;

-- ============================================================ 5. the review queue, for a human

create or replace function kinetype.flag_report()
returns table(handle text, display_name text, flags integer, last_flag_at timestamptz,
              unpaid_xp bigint, recent_reasons text)
language sql
stable security definer
set search_path to 'kinetype', 'public'
as $function$
  select p.handle, p.display_name, p.flags, p.last_flag_at,
         (select coalesce(sum(m.xp_awarded), 0) from kinetype.matches m
           where m.user_id = p.id and m.flag_reason is not null) as unpaid_xp,
         (select string_agg(r.flag_reason, '; ')
            from (select m.flag_reason from kinetype.matches m
                   where m.user_id = p.id and m.flag_reason is not null
                   order by m.created_at desc limit 5) r)
  from kinetype.profiles p
  where p.flags > 0
  order by p.flags desc, p.last_flag_at desc;
$function$;

-- Operator-only: not reachable with the anon key, by design.
revoke all on function kinetype.flag_report() from public, anon, authenticated;

-- CLEARING A FLAG (run in the SQL editor, as the owner):
--   select * from kinetype.flag_report();
--   update kinetype.profiles set flags = 0, last_flag_at = null where handle = '<handle>';
--   update kinetype.matches set flag_reason = null where user_id = (select id from kinetype.profiles where handle = '<handle>');
