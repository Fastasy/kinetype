-- 0008_difficulty_rewards.sql
--
-- THE PROBLEM, stated plainly: the payout ignored the opponent. Beating the 20 WPM warm-up paid
-- exactly what beating the 120 WPM final boss paid, so the nine-rung ladder was decoration on the
-- reward side. `matches.bot_wpm` was already being recorded — nothing read it.
--
-- WHAT CHANGES: a WIN is scaled by the opponent's rung, from 75% at 20 WPM to 325% at 120 WPM.
-- Nothing else about the formula moves.
--
-- THE BALANCE ARGUMENT, so it can be checked rather than believed:
--
--  1. THE ANCHOR IS THE 40 WPM RUNG AT EXACTLY 100%. Break-even sits at 0.75-0.95x the player's own
--     speed and the general adult average is 40-52 WPM, so the median player settles on rung 30-40.
--     Anchoring there leaves the pace chosen in 0007 (about 28 days to own the catalogue) intact for
--     that player, and makes every rung above it earned. If that pace needs retuning, move this
--     anchor or the price tiers, not both at once.
--
--  2. LOSSES ARE NOT SCALED. A loss pays exactly what it paid before. That is deliberate and it is
--     the anti-farm rule: if a loss scaled too, "select the hardest bot and throw matches" would
--     out-earn playing at your own level, because the match timer bounds the rate and losing needs
--     no skill. Measured after the change, a win beats a loss at every single rung: 1.4x at 20 WPM
--     rising to 5.9x at 120 WPM.
--
--  3. THE BOSS TERMS ARE NOT SCALED. A boss's first-clear bounty is already priced per boss in
--     kinetype.boss_rewards (25 coins for Tick up to 400 for Oblivion), and the flat +60 boss win
--     bonus is a mode marker. Scaling either would charge the same difficulty twice.
--
--  4. THE SCALING IS INTEGER-EXACT: (base * pct + 50) / 100 with integer division, which is the
--     arithmetic game/progression.ts:scaleByPct() performs with Math.floor. `round(base * pct /
--     100.0)` would drift a coin or two from the TypeScript in binary floating point, and the two
--     sides are pinned together by an equality test.
--
-- ALSO FIXED HERE: `p_bot_wpm` was stored raw, so a client could write 999999 into
-- matches.bot_wpm. It is now snapped to the nearest real rung before it is scored or stored.

begin;

-- ============================================================ the difficulty ladder
-- Two parallel lists, exactly as the TypeScript keeps them (BOT_WPM_LADDER, DIFFICULTY_PCT), and
-- the mirror test asserts both against the TypeScript constants.

-- The rung an opponent sits on. Values between two rungs snap DOWN, and a tie (45 sits between 40
-- and 50) also resolves downward, which is the conservative direction: an ambiguous rung can only
-- ever pay the lower figure.
create or replace function kinetype.rung_index(p_bot_wpm integer)
returns integer
language sql immutable set search_path = pg_catalog
as $$
  select idx
  from (values (0,20),(1,30),(2,40),(3,50),(4,60),(5,70),(6,85),(7,100),(8,120)) as r(idx, wpm)
  order by abs(wpm - least(400, greatest(0, coalesce(p_bot_wpm, 40)))), idx
  limit 1;
$$;

/** The rung's WPM, for storing what was actually fought. */
create or replace function kinetype.rung_wpm(p_bot_wpm integer)
returns integer
language sql immutable set search_path = pg_catalog
as $$
  select (array[20,30,40,50,60,70,85,100,120])[kinetype.rung_index(p_bot_wpm) + 1];
$$;

/** The percentage of a WIN this opponent's rung is worth. Index 2 (40 WPM) is the 100% anchor. */
create or replace function kinetype.difficulty_pct(p_bot_wpm integer)
returns integer
language sql immutable set search_path = pg_catalog
as $$
  select (array[75,88,100,125,155,190,230,275,325])[kinetype.rung_index(p_bot_wpm) + 1];
$$;

-- ============================================================ xp_for_match()
-- Signature grows by p_bot_wpm, so the old 7-argument version must be dropped. It carried no
-- explicit grant (it is only ever called from submit_match, which is SECURITY DEFINER), so there is
-- nothing to restore — but if anyone grants it later, note that a DROP hands the grant back.
drop function if exists kinetype.xp_for_match(boolean, integer, numeric, numeric, integer, text, boolean);

create or replace function kinetype.xp_for_match(
  p_won          boolean,
  p_rounds_won   integer,
  p_wpm          numeric,
  p_accuracy     numeric,
  p_streak       integer,
  p_mode         text,
  p_boss_cleared boolean,
  p_bot_wpm      integer
) returns integer
language sql immutable set search_path = pg_catalog
as $$
  with perf as (
    select (
        (case when p_won then 40 else 12 end)
      + least(5, greatest(0, p_rounds_won)) * 10
      + round(least(400, greatest(0, p_wpm))::numeric * 0.6)
      + round(least(100, greatest(0, p_accuracy))::numeric / 100.0 * 30)
      + least(5, greatest(0, p_streak)) * 8
    )::integer as base
  )
  select greatest(0,
      (case when p_won
            then (base * kinetype.difficulty_pct(p_bot_wpm) + 50) / 100
            else base end)
    + (case when p_mode = 'boss' then 60 else 0 end)
    + (case when p_boss_cleared then 140 else 0 end)
  )
  from perf;
$$;

-- ============================================================ coins_for_match()
-- Same formula as XP minus the boss terms, so the two currencies move together and this file keeps
-- one ladder instead of two. Mirrors game/progression.ts:coinsForMatch().
drop function if exists kinetype.coins_for_match(boolean, integer, numeric, numeric, integer);

create or replace function kinetype.coins_for_match(
  p_won        boolean,
  p_rounds_won integer,
  p_wpm        numeric,
  p_accuracy   numeric,
  p_streak     integer,
  p_bot_wpm    integer
) returns integer
language sql immutable set search_path = pg_catalog
as $$
  with perf as (
    select (
        (case when p_won then 40 else 12 end)
      + least(5, greatest(0, p_rounds_won)) * 10
      + round(least(400, greatest(0, p_wpm))::numeric * 0.6)
      + round(least(100, greatest(0, p_accuracy))::numeric / 100.0 * 30)
      + least(5, greatest(0, p_streak)) * 8
    )::integer as base
  )
  select greatest(0,
      (case when p_won
            then (base * kinetype.difficulty_pct(p_bot_wpm) + 50) / 100
            else base end)
  )
  from perf;
$$;

-- ============================================================ submit_match()
-- Same signature as 0007 (so this is a plain replace and the execute grant survives). Three edits:
-- pass the opponent's rung into both formulas, and store the SNAPPED rung rather than the raw value
-- the client sent.
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
  C_FIRST_WIN_BONUS     constant integer := 100;

  v_uid       uuid := auth.uid();
  v_first     boolean := false;
  v_boss_pay  integer := 0;
  v_rung      integer;
  v_xp        integer;
  v_coins     integer;
  v_recent    integer;
  v_today_xp  integer;
  v_last      timestamptz;
  v_flag      text := null;
  v_row       kinetype.profiles;

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
  -- The rung is snapped to a real ladder value here, once, and used for both the scoring and the
  -- stored row, so a client cannot claim a difficulty the ladder does not have.
  v_rung := kinetype.rung_wpm(p_bot_wpm);

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
    coalesce(p_accuracy, 0), coalesce(p_streak, 0), coalesce(p_mode, 'free'), v_first, v_rung);

  v_coins := kinetype.coins_for_match(
    coalesce(p_won, false), coalesce(p_rounds_won, 0), coalesce(p_wpm, 0),
    coalesce(p_accuracy, 0), coalesce(p_streak, 0), v_rung) + v_boss_pay;

  -- ---- the daily streak and its bonuses -------------------------------------------------------
  select p.streak_days, p.last_played_on, p.streak_awarded, p.first_win_on
    into v_prev_days, v_prev_last, v_prev_award, v_prev_first
  from kinetype.profiles p where p.id = v_uid;

  if v_flag is null then
    v_today := (now() at time zone 'utc')::date;

    if v_prev_last is null then
      v_streak := 1;
    elsif v_prev_last = v_today then
      v_streak := coalesce(v_prev_days, 1);
    elsif v_prev_last = v_today - 1 then
      v_streak := coalesce(v_prev_days, 0) + 1;
    else
      v_streak := 1;
    end if;

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
    (v_uid, coalesce(p_mode, 'free'), p_boss_id, v_rung,
     coalesce(p_won, false), coalesce(p_wpm, 0), coalesce(p_accuracy, 0),
     coalesce(p_best_combo, 0), coalesce(p_rounds_won, 0), coalesce(p_rounds_lost, 0), v_xp, v_flag);

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

commit;
