-- 0007_economy.sql
--
-- The problem, measured: the entire cosmetic catalogue cost 4,130 coins and the live board paid
-- 177 coins a match — so a player owned EVERYTHING in about 23 matches, roughly half an hour. The
-- boss ladder (level 12) runs out at about the same time. After that there is nothing left to want,
-- which is the real reason the game does not hold anyone.
--
-- Two changes, and they are separate on purpose:
--
--  1. PRICES BY TIER, so rarity means something. Ember (common) is 120 and Voidwing (legendary)
--     900 — only 7.5x across three tiers, which is not a ladder, it is a rounding error. Now:
--     common 1 500, rare 5 000, legendary 15 000, for 52 500 across the paid catalogue.
--
--     Sized against the MEASURED earning rate (177 coins/match, ~10 matches a day = ~1 900/day):
--     about 28 days for everything, about 8 days for one legendary. That was the chosen pace.
--     A tuner's note: the whole pace lives in the three numbers below and nowhere else.
--
--  2. A REASON TO COME BACK TOMORROW. A daily streak was already implicit in the match history (it
--     is what the activity heatmap draws) but nothing rewarded it. Now a consecutive-day streak is
--     tracked server-side, the FIRST WIN each day pays a bonus, and the streak pays milestones.
--
-- WHAT IS DELIBERATELY NOT HERE
--
--  * The coin FORMULA is untouched. Earning per match is unchanged, so the pace above is set by
--    prices alone and can be retuned in one place without touching the score.
--  * The bonuses pay COINS ONLY, never XP. XP drives the level curve and unlocks the boss ladder,
--    and it is pinned by a test that mirrors kinetype.xp_for_match; a daily bonus must not be able
--    to move the ladder.
--  * Bonuses are NOT paid on a flagged submission (see 0006). Otherwise a script could farm the
--    daily bonus, which is exactly the door 0006 closed.

-- ================================================================== 1. prices by tier

update kinetype.cosmetics set price = 1500  where kind = 'skin'  and id in ('ember', 'tide')
                                                            or kind = 'theme' and id in ('midnight', 'sunset', 'frost');
update kinetype.cosmetics set price = 5000  where kind = 'skin'  and id in ('monolith', 'violet-static')
                                                            or kind = 'theme' and id = 'neon';
update kinetype.cosmetics set price = 15000 where kind = 'skin'  and id = 'voidwing'
                                                            or kind = 'theme' and id = 'volcano';

-- The starters must stay free, or a new player cannot play their own skin.
update kinetype.cosmetics set price = 0 where id in ('spark', 'paper');

-- ================================================== 2. somewhere to keep the streak

alter table kinetype.profiles add column if not exists streak_days    integer not null default 0;
alter table kinetype.profiles add column if not exists last_played_on date;
alter table kinetype.profiles add column if not exists streak_awarded  integer not null default 0;
alter table kinetype.profiles add column if not exists first_win_on    date;

comment on column kinetype.profiles.streak_days is
  'Consecutive UTC days with at least one honest match. Derived server-side from match history, never sent by a client.';
comment on column kinetype.profiles.streak_awarded is
  'Highest streak milestone already paid, so a milestone pays once per streak. Reset when the chain breaks.';

-- ======================================= 3. submit_match: track the streak, pay the daily reward

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
  C_SUSPICIOUS_WPM      constant integer := 200;
  C_IMPOSSIBLE_WPM      constant integer := 320;
  C_MIN_GAP_SECONDS     constant integer := 5;
  -- The daily hook: the first WIN of each day pays this, once. Small next to a match, big next to
  -- nothing, which is what makes it worth opening the game for.
  C_FIRST_WIN_BONUS     constant integer := 100;

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

  -- streak state
  v_today      date;
  v_prev_days  integer;
  v_prev_last  date;
  v_prev_award integer;
  v_prev_first date;
  v_streak     integer;
  v_award_base integer;
  v_award_new  integer;
  v_mile_day   integer;
  v_mile_coins integer := 0;
  v_bonus      integer := 0;
  v_first_win  boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform kinetype.ensure_profile();

  -- ---- refuse what the rules make impossible -------------------------------------------------
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

  -- ---- flag what only a script produces ------------------------------------------------------
  select max(m.created_at) into v_last from kinetype.matches m where m.user_id = v_uid;

  if coalesce(p_wpm, 0) > C_SUSPICIOUS_WPM then
    v_flag := format('typing speed of %s wpm', round(coalesce(p_wpm, 0)));
  elsif coalesce(p_accuracy, 0) >= 100 and coalesce(p_wpm, 0) > 150 then
    v_flag := format('perfect accuracy at %s wpm', round(coalesce(p_wpm, 0)));
  elsif v_last is not null and now() - v_last < make_interval(secs => C_MIN_GAP_SECONDS) then
    v_flag := format('submitted %s seconds after the previous match',
                     round(extract(epoch from (now() - v_last))));
  end if;

  -- ---- what the match is worth ---------------------------------------------------------------
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

  -- ---- the daily streak and its bonuses -------------------------------------------------------
  -- Only an honest match moves the chain: a flagged submission is not a day played.
  select p.streak_days, p.last_played_on, p.streak_awarded, p.first_win_on
    into v_prev_days, v_prev_last, v_prev_award, v_prev_first
  from kinetype.profiles p where p.id = v_uid;

  if v_flag is null then
    v_today := (now() at time zone 'utc')::date;

    if v_prev_last is null then
      v_streak := 1;                        -- first honest day ever
    elsif v_prev_last = v_today then
      v_streak := coalesce(v_prev_days, 1); -- already counted today
    elsif v_prev_last = v_today - 1 then
      v_streak := coalesce(v_prev_days, 0) + 1;  -- consecutive
    else
      v_streak := 1;                        -- the chain broke; start again
    end if;

    -- A broken chain re-opens its milestones. Farming them is not worth it: four days of play is
    -- worth far more than the 250 the first milestone pays.
    v_award_base := case when v_streak = 1 then 0 else coalesce(v_prev_award, 0) end;
    v_award_new  := v_award_base;

    if coalesce(p_won, false) and v_prev_first is distinct from v_today then
      v_bonus := v_bonus + C_FIRST_WIN_BONUS;
      v_first_win := true;
    end if;

    select m.day, m.coins into v_mile_day, v_mile_coins
    from (values (3, 250), (7, 600), (14, 1500), (30, 3500)) as m(day, coins)
    where m.day <= v_streak and m.day > v_award_base
    order by m.day desc
    limit 1;

    if v_mile_day is not null then
      v_bonus     := v_bonus + v_mile_coins;
      v_award_new := v_mile_day;
    end if;

    v_coins := v_coins + v_bonus;
  end if;

  -- A flagged match pays nothing at all, bonuses included.
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
    streak_days    = case when v_flag is null then v_streak     else p.streak_days end,
    last_played_on = case when v_flag is null then v_today      else p.last_played_on end,
    streak_awarded = case when v_flag is null then v_award_new  else p.streak_awarded end,
    first_win_on   = case when v_first_win     then v_today     else p.first_win_on end,
    updated_at    = now()
  where p.id = v_uid;

  select * into v_row from kinetype.profiles where id = v_uid;
  return v_row;
end $function$;

-- ================================== 4. the streak is public too
-- It is the visible half of the daily hook, and a stat a player wants on their profile. Adding a
-- column to a RETURNS TABLE changes its signature, so the function has to be dropped first — and
-- dropping it HANDS BACK its execute grant, which must be restored or the profile page (which calls
-- this as `anon`) stops working entirely.
drop function if exists kinetype.public_profile(text);

create or replace function kinetype.public_profile(p_handle text)
returns table(handle text, display_name text, avatar_url text, xp bigint, level integer,
              best_wpm numeric, best_accuracy numeric, matches integer, wins integer, losses integer,
              best_streak integer, streak_days integer, bosses_cleared integer,
              equipped_skin text, equipped_theme text, owned_skins text[], owned_themes text[],
              joined timestamp with time zone)
language sql
stable security definer
set search_path to 'kinetype', 'public'
as $function$
  select p.handle, p.display_name, p.avatar_url,
         p.xp::bigint, p.level, p.best_wpm, p.best_accuracy,
         p.matches, p.wins, p.losses, p.best_streak, p.streak_days,
         p.bosses_cleared, p.equipped_skin, p.equipped_theme,
         p.owned_skins, p.owned_themes, p.created_at
  from kinetype.profiles p
  where p.handle = kinetype.slugify(p_handle)
    and p.show_on_leaderboard
  limit 1;
$function$;

grant execute on function kinetype.public_profile(text) to anon, authenticated;
