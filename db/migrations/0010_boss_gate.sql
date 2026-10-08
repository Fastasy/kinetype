-- Kinetype 0010 — a locked boss is not enterable, on either side of the wire.
--
-- THE HOLE. `/play?boss=<id>` is a server-rendered route that turned the arena into ANY boss in
-- the roster, whatever the account had earned. The campaign page gated the BUTTONS, but the URL is
-- a second front door and it was never locked: a level-1 account could paste
-- `/play?boss=oblivion` and fight the final boss. And because `submit_match()` paid any payload it
-- was handed, the same paste also BANKED the XP, the flat boss bonus, the one-time coin bounty and
-- the boss CLEAR — the ladder could be skipped outright, not merely previewed.
--
-- THE RULE. "Which bosses may this player enter" is already stated once, in TypeScript, by
-- `bossUnlocked()` in game/progression.ts: the player's LEVEL must clear the boss's `unlockLevel`
-- AND the previous boss must already be beaten. Two conditions, both required, and both derivable
-- from rows the server owns (profiles.level, boss_clears). So the rule moves to SQL as a mirror,
-- the same way the reward tables and the quest rotation were mirrored:
--
--   * `kinetype.boss_defs` carries the roster's ORDER and LEVEL GATE — the two facts the rule reads
--     out of the TS array (BOSSES order, BOSSES[].unlockLevel). `boss_rewards` already carries the
--     third fact, the coin bounty.
--   * `kinetype.boss_unlocked(level, boss_id, cleared[])` is the rule itself, mirrored.
--   * `submit_match()` refuses a boss payload the player has not unlocked, raising like every other
--     impossible submission. This is the load-bearing half: the UI gate can be skipped by typing a
--     URL, and this one cannot.
--
-- Drift between the TS and SQL copies is a FAILING TEST, not a surprise: `scripts/verify-bosses.ts`
-- compares `boss_defs` against the roster field by field and walks
-- `boss_unlocked()` against `bossUnlocked()` over every boss, every level 1..13 and a spread of
-- cleared sets. `scripts/probe-boss-gate.ts` proves the refusal and the allowance against the live
-- project. Specified in docs/GAME-DESIGN.md §17.
--
-- Idempotent and additive; safe to re-run.

-- ================================================================ the roster, as data
-- Mirrors game/progression.ts:BOSSES. `ord` is the sequence the ladder is unlocked along (1-based,
-- where TS uses a 0-based index); `unlock_level` is the boss's `unlockLevel`.
create table if not exists kinetype.boss_defs (
  boss_id      text    primary key,
  ord          integer not null unique check (ord >= 1),
  unlock_level integer not null check (unlock_level >= 1)
);

insert into kinetype.boss_defs (boss_id, ord, unlock_level) values
  ('tick',      1,  1),
  ('bandit',    2,  2),
  ('vex',       3,  3),
  ('havoc',     4,  4),
  ('quartz',    5,  5),
  ('cannon',    6,  6),
  ('nimbus',    7,  8),
  ('vortex',    8, 10),
  ('oblivion',  9, 12)
on conflict (boss_id) do update
  set ord = excluded.ord, unlock_level = excluded.unlock_level;

alter table kinetype.boss_defs enable row level security;
-- No policies: unreachable directly, like cosmetics and boss_rewards. Read only through the
-- function below.
revoke all on kinetype.boss_defs from anon, authenticated, public;

-- ================================================================ boss_unlocked()
-- MIRRORS game/progression.ts:bossUnlocked() ONE-FOR-ONE.
--
--   level < boss.unlockLevel            -> false   (the level gate)
--   the FIRST boss (ord 1)              -> true    (nothing precedes it)
--   otherwise                           -> the previous ord's boss_id is in the cleared set
--
-- An unknown boss_id is false: the caller is expected to validate the id separately (submit_match
-- raises 'Unknown boss.'), and a rule that answers true for a name it has never heard of would be
-- the wrong default here.
--
-- SECURITY DEFINER because boss_defs is RLS-locked with no grants; public EXECUTE is granted
-- deliberately — it reads a fixed, public roster and no player data, so there is nothing to leak
-- and it keeps the rule callable from any future server-side caller.
create or replace function kinetype.boss_unlocked(
  p_level integer, p_boss_id text, p_cleared text[]
) returns boolean
language sql
stable
security definer
set search_path to 'kinetype', 'public'
as $function$
  select case
    when d.boss_id is null                                then false  -- unknown boss
    when coalesce(p_level, 0) < d.unlock_level            then false  -- not this level yet
    when d.ord <= 1                                       then true   -- the first rung
    else exists (
      select 1 from kinetype.boss_defs p
      where p.ord = d.ord - 1
        and p.boss_id = any (coalesce(p_cleared, '{}'::text[]))
    )
  end
  from (select 1) as seed
  left join kinetype.boss_defs d on d.boss_id = p_boss_id;
$function$;

grant execute on function kinetype.boss_unlocked(integer, text, text[]) to anon, authenticated;

-- ================================================================ submit_match()
-- Same signature and same grants as 0009 (a plain replace), so the live client is unchanged: the
-- only new work is the refusal block below, placed with the other impossible-submission checks.

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
  v_q_xp      integer := 0;
  v_q_coins   integer := 0;
  v_capped    boolean := false;
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

  -- ---- a boss the player has not unlocked is not a boss they may fight ------------------------
  -- The UI gate (FightClient) exists for HONESTY: a locked arena now refuses to start, so nobody
  -- plays twelve rounds into a fight the server will throw away. This is the half that CANNOT be
  -- bypassed, and it is the same rule derived from rows the server already holds — the profile's
  -- level and the player's own boss_clears. A pasted /play?boss=oblivion on a level-1 account
  -- reaches here and is refused, exactly like an impossible round count.
  if coalesce(p_mode, 'free') = 'boss' then
    if p_boss_id is null then
      raise exception 'A boss match needs a boss.' using errcode = 'P0001';
    end if;

    if not exists (select 1 from kinetype.boss_defs d where d.boss_id = p_boss_id) then
      raise exception 'Unknown boss.' using errcode = 'P0001';
    end if;

    if not kinetype.boss_unlocked(
             (select p.level from kinetype.profiles p where p.id = v_uid),
             p_boss_id,
             (select coalesce(array_agg(b.boss_id), '{}'::text[])
                from kinetype.boss_clears b where b.user_id = v_uid)) then
      raise exception 'That boss is not unlocked yet.' using errcode = 'P0001';
    end if;
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
    v_capped := true;
    v_xp     := 0;
    v_coins  := 0;
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

  -- ---- quests ---------------------------------------------------------------------------------
  -- Scored on the match just recorded, so a finished match can complete a quest in the same call
  -- that pays for the match. Skipped for a flagged match (0006: the game does not believe it) and
  -- for a match on an already-capped day (a farm must not advance the board either).
  if v_flag is null and not v_capped then
    select coalesce(sum(q.xp), 0), coalesce(sum(q.coins), 0)
      into v_q_xp, v_q_coins
    from kinetype.quest_award(v_uid) q;

    v_xp    := v_xp    + v_q_xp;
    v_coins := v_coins + v_q_coins;
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

-- The grant is unchanged from 0009, repeated here so this file is self-contained and re-runnable.
grant execute on function kinetype.submit_match(text, text, integer, boolean, numeric, numeric,
                                                integer, integer, integer, integer)
  to authenticated;
