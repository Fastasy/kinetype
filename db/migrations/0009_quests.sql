-- 0009_quests.sql
--
-- DAILY AND WEEKLY QUESTS: three dailies (one easy, one medium, one hard) and two weeklies, each
-- paying bonus XP and coins, and the set CHANGES EVERY DAY so it cannot be memorised.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- THE TWO PROBLEMS THIS SOLVES, AND WHY IT IS BUILT THIS WAY
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 1. NOTHING TO COME BACK FOR, PAST THE FIRST SESSION. 0007 gave the day a hook (a first-win
--    bonus and a streak) but the hook is the SAME every day and it pays a flat 100. There is no
--    answer to "what should I do TODAY". Quests are that answer, and grading them easy/medium/hard
--    means there is always one worth doing and one worth reaching for.
--
-- 2. THE SAME SET EVERY DAY IS A CHECKLIST, NOT A GAME. So the rotation is a pure function of the
--    DATE — not of the player, and not of a roll. Same day, same quests, for everybody, on every
--    device, without a single row of assignment state. game/quests.ts computes the identical set in
--    TypeScript so the board renders instantly and signed out, and the two are pinned together by
--    scripts/verify-quests.ts, which walks 400+ days and every week and fails on one quest of drift.
--
-- ── WHERE THE TRUST LIVES ──────────────────────────────────────────────────────────────────────
--
-- PROGRESS IS DERIVED, NEVER SENT. Every metric is a count over rows the server ALREADY holds in
-- kinetype.matches — matches played, wins, rounds won, a 2-0, a chain of six, a win at 94%
-- accuracy, a win against a 70 WPM opponent. A client cannot send progress because there is no
-- parameter to send it in. This is why there is no "client reports 3/3" anywhere in this file.
--
-- PAYMENT IS ONCE PER QUEST PER PERIOD, enforced by the PRIMARY KEY on
-- kinetype.quest_awards (user_id, quest_id, period_key). A quest that is complete stays complete;
-- the award is `on conflict do nothing`, so replaying a submission cannot pay it twice.
--
-- A FLAGGED MATCH DOES NOTHING. It does not advance a quest and it cannot complete one (0006's
-- rule — a flagged submission is not a match the game believes). Neither does a match on a day
-- that has already burned the daily XP ceiling, which is a farm by definition.
--
-- THE DAILY CEILING NOW COVERS QUEST XP AS WELL, so "no account mints more than 25 000 XP in a UTC
-- day" stays literally true rather than becoming "25 000 from matches plus whatever quests pay".
-- The guard can only ever REDUCE a payout, so it cannot be turned into a farm.
--
-- ── A DELIBERATE DEVIATION FROM 0007, STATED OUT LOUD ──────────────────────────────────────────
--
-- 0007 says daily bonuses pay COINS ONLY, never XP, because "XP drives the level curve and unlocks
-- the boss ladder, and it is pinned by a test that mirrors xp_for_match". Quests deliberately break
-- that rule at the designer's instruction: they pay XP as well as coins. The consequences are real
-- and bounded, and both are acceptable:
--
--   * XP from quests is TINY next to match XP. A perfect day is at most 340 XP and 480 coins; a
--     single match at the 40 WPM anchor pays ~140. Three quests are worth about two matches.
--   * The ceiling on a perfect week is 3 200 XP and 4 490 coins, against a measured base of ~1 900
--     coins a day (~13 300 a week). That is +34% at PERFECTION and less in practice, because
--     "win at 100% accuracy" and "win three in a row" rarely land the same evening, which pulls the
--     0007 catalogue pace (28 days to own everything) in to roughly 21-24 days for an engaged
--     player and leaves the casual pace where it was.
--   * Quest XP DOES feed the boss ladder, since level is derived from XP. That accelerates the
--     campaign slightly. It is inherent in "quests give XP" and was chosen knowingly.
--
-- IF THE PACE NEEDS RETUNING, move the reward columns in kinetype.quest_defs. Nothing else in the
-- game reads them, and the reward cap is asserted by the test suite so it cannot drift upward by
-- accident.
--
-- Idempotent, additive, safe to re-run. Touches only the `kinetype` schema.

begin;

-- ============================================================================ 1. the period clock
-- Both ordinals are the whole rotation, and both are trivially mirrorable. They are UTC because
-- every other day boundary in this schema is UTC (the streak, the first-win bonus, the boards).

/** Days since 1970-01-01 (UTC). The daily rotation's clock. */
create or replace function kinetype.epoch_day(p_day date)
returns integer language sql immutable set search_path = pg_catalog
as $$ select (p_day - date '1970-01-01')::integer; $$;

/**
 * Monday-aligned weeks. Mirrors game/quests.ts:epochWeek().
 *
 * The +3 is the alignment: 1970-01-01 was a THURSDAY, so day 0 sits three days into its Monday
 * week, and the first Monday (day 4) has to open week 1 rather than week 0.
 */
create or replace function kinetype.epoch_week(p_day date)
returns integer language sql immutable set search_path = pg_catalog
as $$ select ((p_day - date '1970-01-01')::integer + 3) / 7; $$;

/** The Monday that opens the week a day falls in. Mirrors game/quests.ts:mondayKey(). */
create or replace function kinetype.week_start(p_day date)
returns date language sql immutable set search_path = pg_catalog
as $$ select p_day - (((p_day - date '1970-01-01')::integer + 3) % 7); $$;

-- ============================================================================ 2. player progress
-- A quest award is a HISTORICAL FACT and is never rewritten: the reward is copied into the row at
-- the moment it is paid, so retuning a quest tomorrow cannot retroactively change what somebody was
-- paid today, and the row is the audit trail for it.

create table if not exists kinetype.quest_awards (
  user_id    uuid        not null references kinetype.profiles(id) on delete cascade,
  quest_id   text        not null,
  -- 'd:2026-10-07' or 'w:2026-10-05'. The period is the week's MONDAY, not an ISO week number,
  -- because a date is unambiguous without a calendar lookup.
  period_key text        not null,
  scope      text        not null check (scope in ('daily', 'weekly')),
  xp         integer     not null default 0 check (xp >= 0),
  coins      integer     not null default 0 check (coins >= 0),
  awarded_at timestamptz not null default now(),
  -- THE anti-double-pay. One row per quest per period, forever.
  primary key (user_id, quest_id, period_key)
);

create index if not exists kt_quest_awards_user_awarded_idx
  on kinetype.quest_awards (user_id, awarded_at desc);

comment on table kinetype.quest_awards is
  'Quests paid, one row per quest per period. Written only by kinetype.quest_award(); no client write path exists.';

-- ============================================================================ 3. the quest book
-- Server-side definitions. game/quests.ts holds the copy the BOARD renders, exactly as game/skins.ts
-- holds the copy the shop renders, and scripts/verify-quests.ts asserts every field of every row
-- here against the TypeScript and fails loudly on drift.

create table if not exists kinetype.quest_defs (
  id           text    primary key,
  scope        text    not null check (scope in ('daily', 'weekly')),
  tier         text    check (tier in ('easy', 'medium', 'hard')),
  -- Position in its own ordered pool. The rotation walks by this, so a reorder here IS a rotation
  -- change and the drift test will say so.
  sort_order   integer not null,
  metric       text    not null check (metric in (
                 'matches', 'wins', 'rounds_won', 'clean_wins', 'boss_wins', 'win_streak',
                 'fast_matches', 'sharp_wins', 'combo_matches', 'big_scalps')),
  -- The bar the metric must clear. 0 for the metrics that do not use one.
  threshold    numeric not null default 0 check (threshold >= 0),
  target       integer not null check (target >= 1),
  reward_xp    integer not null check (reward_xp >= 0),
  reward_coins integer not null check (reward_coins >= 0),
  title        text    not null,
  detail       text    not null
);

-- Only the daily three are graded; a weekly quest carries no tier.
alter table kinetype.quest_defs drop constraint if exists kt_quest_defs_tier_scope;
alter table kinetype.quest_defs add constraint kt_quest_defs_tier_scope check (
  (scope = 'daily'  and tier is not null) or
  (scope = 'weekly' and tier is null)
);

-- The weekly pairs, one per week, a 15-week cycle. Written out rather than generated: a generated
-- pair can be two near-identical hard quests in the same week, and a curated list cannot.
create table if not exists kinetype.quest_weekly_sets (
  ord      integer not null,
  slot     integer not null check (slot in (0, 1)),
  quest_id text    not null,
  primary key (ord, slot)
);

comment on table kinetype.quest_weekly_sets is
  'The two weekly quests for each week of the rotation cycle, walked one row-set per week.';

-- --------------------------------------------------------------------- the daily, graded three
-- Rewards are sized in the file header. Add, reorder or retire a quest here and the TypeScript
-- mirror plus the drift test must move with it.
insert into kinetype.quest_defs
  (id, scope, tier, sort_order, metric, threshold, target, reward_xp, reward_coins, title, detail)
values
  -- easy
  ('daily-play-3',   'daily', 'easy', 0, 'matches',       0,   3,  35,  50, 'Three Rounds In',  'Play 3 matches today.'),
  ('daily-win-1',    'daily', 'easy', 1, 'wins',          0,   1,  40,  55, 'Open The Account', 'Win a match today.'),
  ('daily-rounds-3', 'daily', 'easy', 2, 'rounds_won',    0,   3,  40,  60, 'Take Three',       'Win 3 rounds today.'),
  ('daily-clean-1',  'daily', 'easy', 3, 'clean_wins',    0,   1,  50,  70, 'Clean Sheet',      'Win a match without dropping a round.'),
  ('daily-combo-6',  'daily', 'easy', 4, 'combo_matches', 6,   1,  40,  60, 'Six Deep',         'Land a chain of 6 clean words.'),
  ('daily-play-5',   'daily', 'easy', 5, 'matches',       0,   5,  50,  70, 'Warm Up Properly', 'Play 5 matches today.'),
  -- medium
  ('daily-win-2',    'daily', 'medium', 0, 'wins',         0,  2,  85, 120, 'Back It Up',        'Win 2 matches today.'),
  ('daily-streak-2', 'daily', 'medium', 1, 'win_streak',   0,  2,  90, 130, 'Two On The Trot',   'Win 2 matches in a row.'),
  ('daily-fast-45',  'daily', 'medium', 2, 'fast_matches', 45, 2,  80, 115, 'Finding Fifth Gear','Finish 2 matches at 45 WPM or faster.'),
  ('daily-sharp-94', 'daily', 'medium', 3, 'sharp_wins',   94, 1,  85, 120, 'Surgical',          'Win a match at 94% accuracy or better.'),
  ('daily-scalp-50', 'daily', 'medium', 4, 'big_scalps',   50, 1,  90, 125, 'Punching Up',       'Beat an opponent at 50 WPM or higher.'),
  ('daily-rounds-6', 'daily', 'medium', 5, 'rounds_won',   0,  6,  85, 125, 'Split Them Open',   'Win 6 rounds today.'),
  ('daily-combo-9',  'daily', 'medium', 6, 'combo_matches', 9, 1,  95, 140, 'Three Rungs Up',    'Land a chain of 9 clean words.'),
  -- hard
  ('daily-win-4',    'daily', 'hard', 0, 'wins',         0,   4, 165, 235, 'Untouchable',  'Win 4 matches today.'),
  ('daily-streak-3', 'daily', 'hard', 1, 'win_streak',   0,   3, 185, 260, 'Hat-Trick',    'Win 3 matches in a row.'),
  ('daily-fast-60',  'daily', 'hard', 2, 'fast_matches', 60,  2, 175, 250, 'Flat Out',     'Finish 2 matches at 60 WPM or faster.'),
  ('daily-flawless', 'daily', 'hard', 3, 'sharp_wins',   100, 1, 195, 270, 'Flawless',     'Win a match at 100% accuracy.'),
  ('daily-scalp-70', 'daily', 'hard', 4, 'big_scalps',   70,  1, 185, 260, 'Giant Killer', 'Beat an opponent at 70 WPM or higher.'),
  -- weekly
  ('weekly-matches-20', 'weekly', null, 0, 'matches',      0,  20, 340, 470, 'Regular',        'Play 20 matches this week.'),
  ('weekly-wins-8',     'weekly', null, 1, 'wins',         0,   8, 330, 460, 'Eight Down',     'Win 8 matches this week.'),
  ('weekly-boss-3',     'weekly', null, 2, 'boss_wins',    0,   3, 320, 440, 'Campaigner',     'Win 3 boss fights this week.'),
  ('weekly-fast-55',    'weekly', null, 3, 'fast_matches', 55,  5, 350, 480, 'Cruising Speed', 'Finish 5 matches at 55 WPM or faster.'),
  ('weekly-streak-5',   'weekly', null, 4, 'win_streak',   0,   5, 400, 550, 'Five Alive',     'Win 5 matches in a row this week.'),
  ('weekly-scalp-85',   'weekly', null, 5, 'big_scalps',   85,  3, 420, 580, 'Storm Chaser',   'Beat 3 opponents at 85 WPM or higher.')
on conflict (id) do update set
  scope        = excluded.scope,
  tier         = excluded.tier,
  sort_order   = excluded.sort_order,
  metric       = excluded.metric,
  threshold    = excluded.threshold,
  target       = excluded.target,
  reward_xp    = excluded.reward_xp,
  reward_coins = excluded.reward_coins,
  title        = excluded.title,
  detail       = excluded.detail;

-- Retire anything no longer in the book, so the table cannot accumulate ghosts the board never
-- shows but the drift test would have to explain. The sets are rebuilt below, so they go first.
delete from kinetype.quest_weekly_sets;
delete from kinetype.quest_defs
 where id not in (
   'daily-play-3', 'daily-win-1', 'daily-rounds-3', 'daily-clean-1', 'daily-combo-6', 'daily-play-5',
   'daily-win-2', 'daily-streak-2', 'daily-fast-45', 'daily-sharp-94', 'daily-scalp-50',
   'daily-rounds-6', 'daily-combo-9',
   'daily-win-4', 'daily-streak-3', 'daily-fast-60', 'daily-flawless', 'daily-scalp-70',
   'weekly-matches-20', 'weekly-wins-8', 'weekly-boss-3', 'weekly-fast-55', 'weekly-streak-5',
   'weekly-scalp-85'
 );

-- All fifteen pairs of the six weekly quests, ordered so a hard ask is not stacked behind another
-- hard ask. Every quest appears in exactly five pairs (asserted by the test suite).
insert into kinetype.quest_weekly_sets (ord, slot, quest_id) values
  (0,  0, 'weekly-matches-20'), (0,  1, 'weekly-scalp-85'),
  (1,  0, 'weekly-wins-8'),     (1,  1, 'weekly-fast-55'),
  (2,  0, 'weekly-boss-3'),     (2,  1, 'weekly-streak-5'),
  (3,  0, 'weekly-matches-20'), (3,  1, 'weekly-fast-55'),
  (4,  0, 'weekly-wins-8'),     (4,  1, 'weekly-boss-3'),
  (5,  0, 'weekly-fast-55'),    (5,  1, 'weekly-scalp-85'),
  (6,  0, 'weekly-wins-8'),     (6,  1, 'weekly-streak-5'),
  (7,  0, 'weekly-matches-20'), (7,  1, 'weekly-boss-3'),
  (8,  0, 'weekly-boss-3'),     (8,  1, 'weekly-scalp-85'),
  (9,  0, 'weekly-matches-20'), (9,  1, 'weekly-streak-5'),
  (10, 0, 'weekly-wins-8'),     (10, 1, 'weekly-scalp-85'),
  (11, 0, 'weekly-fast-55'),    (11, 1, 'weekly-boss-3'),
  (12, 0, 'weekly-matches-20'), (12, 1, 'weekly-wins-8'),
  (13, 0, 'weekly-streak-5'),   (13, 1, 'weekly-fast-55'),
  (14, 0, 'weekly-streak-5'),   (14, 1, 'weekly-scalp-85');

-- ============================================================================ 4. the rotation
-- A pure function of the date, and nothing else. Same three dailies and same two weeklies for
-- everybody who plays on a given day, computable without reading a single player's row.

/**
 * One tier's pool, in rotation order.
 * `p_tier is null` returns the whole scope, which is what the reward caps need.
 *
 * SECURITY DEFINER because kinetype.quest_defs is locked shut (RLS on, no policies, no grants) and
 * this is callable straight off the API as the rotation oracle. It returns quest IDS and nothing
 * else — no player data is reachable through it.
 */
create or replace function kinetype.quest_pool_ids(p_scope text, p_tier text default null)
returns text[] language sql stable security definer set search_path = kinetype, pg_catalog
as $$
  select coalesce(array_agg(q.id order by q.sort_order), '{}'::text[])
  from kinetype.quest_defs q
  where q.scope = p_scope and (p_tier is null or q.tier = p_tier);
$$;

/**
 * The five quest ids for a day: three dailies (easy, medium, hard) then two weeklies.
 *
 * THE DAILY WALK. Each tier is an ordered pool walked with a stride of ONE, so consecutive days are
 * always different — never the same quest twice running. Each tier starts at its own offset so the
 * tiers do not move in lockstep, and the pool sizes are deliberately unequal (6, 7, 5) so the daily
 * SET has a 210-day period: easy x hard alone only repeats every 30 days, which is why a player
 * cannot learn the rotation by heart inside a month.
 *
 * THE WEEKLY WALK. One curated pair per week, cycling every fifteen weeks.
 *
 * A tier with an empty pool is SKIPPED rather than raising. A misconfigured quest book must not
 * take match submission down with it; the pool is asserted non-empty by scripts/verify-quests.ts
 * and by game/tests/quests.test.ts, so it cannot be empty quietly.
 */
create or replace function kinetype.quest_ids_for(p_day date)
returns text[] language plpgsql stable security definer set search_path = kinetype, pg_catalog
as $$
declare
  v_day    integer := kinetype.epoch_day(p_day);
  v_week   integer := kinetype.epoch_week(p_day);
  v_out    text[]  := '{}'::text[];
  v_pool   text[];
  v_cycles integer;
  v_set    text[];
begin
  -- daily: easy (+0), medium (+2), hard (+4)
  v_pool := kinetype.quest_pool_ids('daily', 'easy');
  if array_length(v_pool, 1) is not null then
    v_out := v_out || v_pool[1 + ((v_day + 0) % array_length(v_pool, 1))];
  end if;

  v_pool := kinetype.quest_pool_ids('daily', 'medium');
  if array_length(v_pool, 1) is not null then
    v_out := v_out || v_pool[1 + ((v_day + 2) % array_length(v_pool, 1))];
  end if;

  v_pool := kinetype.quest_pool_ids('daily', 'hard');
  if array_length(v_pool, 1) is not null then
    v_out := v_out || v_pool[1 + ((v_day + 4) % array_length(v_pool, 1))];
  end if;

  -- weekly pair
  select count(distinct s.ord) into v_cycles from kinetype.quest_weekly_sets s;
  if coalesce(v_cycles, 0) > 0 then
    select coalesce(array_agg(s.quest_id order by s.slot), '{}'::text[])
      into v_set
    from kinetype.quest_weekly_sets s
    where s.ord = (v_week % v_cycles);
    v_out := v_out || v_set;
  end if;

  return v_out;
end $$;

/**
 * The day's rotation, resolved. Read-only and secret-free — this is the ORACLE
 * scripts/verify-quests.ts compares the TypeScript rotation against, and it is what makes the
 * client safe to render the board from its own copy.
 */
create or replace function kinetype.quest_plan(p_day date)
returns table (ord integer, quest_id text, scope text, tier text, metric text, threshold numeric,
               target integer, reward_xp integer, reward_coins integer)
language sql stable security definer set search_path = kinetype, pg_catalog
as $$
  select u.ord::integer, q.id, q.scope, q.tier, q.metric, q.threshold, q.target,
         q.reward_xp, q.reward_coins
  from unnest(kinetype.quest_ids_for(p_day)) with ordinality as u(id, ord)
  join kinetype.quest_defs q on q.id = u.id
  order by u.ord;
$$;

/** The whole quest book, for tooling. Read-only, mirror of game/quests.ts:QUEST_DEFS. */
create or replace function kinetype.quest_catalog()
returns table (id text, scope text, tier text, sort_order integer, metric text, threshold numeric,
               target integer, reward_xp integer, reward_coins integer, title text, detail text)
language sql stable security definer set search_path = kinetype, pg_catalog
as $$
  select q.id, q.scope, q.tier, q.sort_order, q.metric, q.threshold, q.target,
         q.reward_xp, q.reward_coins, q.title, q.detail
  from kinetype.quest_defs q
  order by q.scope, q.tier nulls last, q.sort_order;
$$;

-- ============================================================================ 5. the windows
-- ONE place decides which quests are live and what time window each is scored over. quest_award()
-- and my_quests() both read it, so the board and the payout cannot disagree about whether a week
-- has turned over.

create or replace function kinetype.active_quests(p_now timestamptz default now())
returns table (quest_id text, scope text, tier text, metric text, threshold numeric, target integer,
               reward_xp integer, reward_coins integer, period_key text,
               win_from timestamptz, win_to timestamptz)
language sql stable security definer set search_path = kinetype, pg_catalog
as $$
  with bounds as (
    select (p_now at time zone 'utc')::date                                   as day,
           (date_trunc('day', p_now at time zone 'utc') at time zone 'utc')   as day_from,
           ((date_trunc('day', p_now at time zone 'utc') + interval '1 day')
              at time zone 'utc')                                            as day_to
  ),
  wek as (
    select kinetype.week_start(b.day)                                            as wk_day,
           (kinetype.week_start(b.day)::timestamp at time zone 'utc')            as wk_from,
           ((kinetype.week_start(b.day) + 7)::timestamp at time zone 'utc')      as wk_to
    from bounds b
  )
  select q.id, q.scope, q.tier, q.metric, q.threshold, q.target, q.reward_xp, q.reward_coins,
         case q.scope when 'daily' then 'd:' || to_char(b.day, 'YYYY-MM-DD')
                      else 'w:' || to_char(w.wk_day, 'YYYY-MM-DD') end,
         case q.scope when 'daily' then b.day_from else w.wk_from end,
         case q.scope when 'daily' then b.day_to   else w.wk_to   end
  from bounds b, wek w,
       unnest(kinetype.quest_ids_for(b.day)) with ordinality as u(id, ord)
  join kinetype.quest_defs q on q.id = u.id
  order by u.ord;
$$;

-- ============================================================================ 6. the scorekeeper

/**
 * How much of a quest the player has done, right now, derived from the matches they actually have.
 *
 * Reads kinetype.matches only, and NOTHING the client said. Flagged matches are excluded, for the
 * same reason 0006 gives: a flagged submission is not a match the game believes, so it must not be
 * able to move a quest.
 *
 * The one metric that is not a count is `win_streak` — the LONGEST run of consecutive wins inside
 * the window, found with the standard gaps-and-islands trick. It is a MAX, so calling this twice
 * with another match in between can legitimately return a smaller number (a loss ends a run), which
 * is exactly why progress is derived fresh here rather than accumulated in a column.
 */
create or replace function kinetype.quest_progress_value(
  p_metric text, p_threshold numeric, p_from timestamptz, p_to timestamptz, p_uid uuid
) returns integer
language sql stable set search_path = kinetype, pg_catalog
as $$
  with ms as (
    select m.id, m.created_at, m.won, m.mode, m.wpm, m.accuracy, m.best_combo, m.bot_wpm,
           m.rounds_won, m.rounds_lost
    from kinetype.matches m
    where m.user_id = p_uid
      and m.created_at >= p_from
      and m.created_at <  p_to
      and m.flag_reason is null
  ),
  agg as (
    select
      count(*)::integer                                                  as c_matches,
      count(*) filter (where m.won)::integer                              as c_wins,
      coalesce(sum(m.rounds_won), 0)::integer                             as c_rounds,
      count(*) filter (where m.won and m.rounds_lost = 0 and m.rounds_won >= 2)::integer as c_clean,
      count(*) filter (where m.won and m.mode = 'boss')::integer           as c_boss,
      count(*) filter (where m.wpm      >= p_threshold)::integer           as c_fast,
      count(*) filter (where m.won and m.accuracy   >= p_threshold)::integer as c_sharp,
      count(*) filter (where m.best_combo >= p_threshold)::integer         as c_combo,
      count(*) filter (where m.won and m.bot_wpm    >= p_threshold)::integer as c_scalp
    from ms m
  ),
  islands as (
    select count(*) as cnt
    from (
      select s.won,
             -- row_number over ALL rows minus row_number over rows of the same outcome is constant
             -- across a run of consecutive identical outcomes, which is the island key.
             row_number() over (order by s.created_at, s.id)
             - row_number() over (partition by s.won order by s.created_at, s.id) as grp
      from ms s
    ) g
    where g.won
    group by g.grp
  ),
  runs as (select coalesce(max(i.cnt), 0)::integer as best from islands i)
  select case p_metric
           when 'matches'       then (select a.c_matches from agg a)
           when 'wins'          then (select a.c_wins    from agg a)
           when 'rounds_won'    then (select a.c_rounds  from agg a)
           when 'clean_wins'    then (select a.c_clean   from agg a)
           when 'boss_wins'     then (select a.c_boss    from agg a)
           when 'fast_matches'  then (select a.c_fast    from agg a)
           when 'sharp_wins'    then (select a.c_sharp   from agg a)
           when 'combo_matches' then (select a.c_combo   from agg a)
           when 'big_scalps'    then (select a.c_scalp   from agg a)
           when 'win_streak'    then (select r.best      from runs r)
           else 0
         end;
$$;

/**
 * Pay every quest the player has completed in the current periods and not already been paid for.
 * Called ONLY from submit_match(), immediately after the match row is written, so it always scores
 * the match that has just finished.
 *
 * Returns how much it paid, so submit_match can fold it into the same profile update as the match.
 * `on conflict do nothing` is the receipt: a quest pays once per period, and a concurrent or
 * replayed call finds the row already there and pays nothing.
 */
create or replace function kinetype.quest_award(p_uid uuid, p_now timestamptz default now())
returns table (xp integer, coins integer)
language plpgsql security definer set search_path = kinetype, pg_catalog
as $$
declare
  C_DAILY_XP_CAP constant integer := 25000;
  v_day_start timestamptz;
  v_today     integer;
  v_xp        integer := 0;
  v_coins     integer := 0;
  v_progress  integer;
  a           record;
begin
  if p_uid is null then
    return query select 0, 0;
    return;
  end if;

  v_day_start := (date_trunc('day', p_now at time zone 'utc') at time zone 'utc');

  -- The ceiling covers quest XP as well as match XP, so the 25 000 XP a day bound holds for the
  -- account rather than for one of its two income streams. It can only reduce a payout.
  select coalesce(sum(m.xp_awarded), 0)
       + coalesce((select sum(q.xp) from kinetype.quest_awards q
                    where q.user_id = p_uid and q.awarded_at >= v_day_start), 0)
    into v_today
  from kinetype.matches m
  where m.user_id = p_uid and m.created_at >= v_day_start;

  if v_today >= C_DAILY_XP_CAP then
    return query select 0, 0;
    return;
  end if;

  for a in select * from kinetype.active_quests(p_now) loop
    v_progress := kinetype.quest_progress_value(a.metric, a.threshold, a.win_from, a.win_to, p_uid);
    continue when v_progress < a.target;

    insert into kinetype.quest_awards (user_id, quest_id, period_key, scope, xp, coins, awarded_at)
    values (p_uid, a.quest_id, a.period_key, a.scope, a.reward_xp, a.reward_coins, p_now)
    on conflict (user_id, quest_id, period_key) do nothing;

    if found then
      v_xp    := v_xp    + a.reward_xp;
      v_coins := v_coins + a.reward_coins;
    end if;
  end loop;

  return query select v_xp, v_coins;
end $$;

-- ============================================================================ 7. the board, as data

/**
 * The caller's live quests with their progress, for the board.
 *
 * Derived, not stored: the progress returned here is recomputed from the match history on every
 * call, so it can never be stale, and it cannot drift from what quest_award() will pay.
 * Signed out, auth.uid() is null and this returns nothing — guests still SEE the rotation (the
 * client computes it locally) but there is no account for rewards to land on.
 *
 * `progress` is the RAW metric, not a fraction of the target: five clean wins against a target of
 * one returns 5. The bar clamps; the number is what happened.
 */
create or replace function kinetype.my_quests(p_now timestamptz default now())
returns table (quest_id text, scope text, tier text, metric text, threshold numeric, target integer,
               reward_xp integer, reward_coins integer, progress integer, completed boolean,
               claimed boolean, period_key text, ends_at timestamptz)
language plpgsql stable security definer set search_path = kinetype, pg_catalog
as $$
declare
  v_uid  uuid := auth.uid();
  v_hit  timestamptz;
  a      record;
begin
  if v_uid is null then
    return;
  end if;

  for a in select * from kinetype.active_quests(p_now) loop
    progress := kinetype.quest_progress_value(a.metric, a.threshold, a.win_from, a.win_to, v_uid);

    select q.awarded_at into v_hit
    from kinetype.quest_awards q
    where q.user_id = v_uid and q.quest_id = a.quest_id and q.period_key = a.period_key;

    quest_id     := a.quest_id;
    scope        := a.scope;
    tier         := a.tier;
    metric       := a.metric;
    threshold    := a.threshold;
    target       := a.target;
    reward_xp    := a.reward_xp;
    reward_coins := a.reward_coins;
    completed    := progress >= a.target;
    claimed      := v_hit is not null;
    period_key   := a.period_key;
    ends_at      := a.win_to;
    return next;
  end loop;
end $$;

-- ============================================================================ 8. submit_match()
-- Same signature and same grants as 0008 (so this is a plain replace, and the live 0008 client
-- keeps working unchanged): the only new work is the quest step after the match is recorded.

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

-- ============================================================================ 9. the boards
-- The daily and weekly boards SUM matches.xp_awarded. Quest XP is not match XP, so without this it
-- would count on the all-time board (which reads profiles.xp) and vanish from the other two — a
-- player who gained 400 XP today would see a daily board that did not move. Quest awards are folded
-- into the windowed sum so all three windows agree with the profile.

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
  windowed as (
    select m.user_id, m.xp_awarded as xp
    from kinetype.matches m, win
    where p_window in ('daily', 'weekly') and m.created_at >= win.since
    union all
    select q.user_id, q.xp
    from kinetype.quest_awards q, win
    where p_window in ('daily', 'weekly') and q.awarded_at >= win.since
  ),
  agg as (
    select w.user_id, sum(w.xp)::bigint as xp_sum
    from windowed w
    group by w.user_id
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

-- ============================================================================ 10. locks and grants

alter table kinetype.quest_defs        enable row level security;
alter table kinetype.quest_weekly_sets enable row level security;
alter table kinetype.quest_awards      enable row level security;

-- The book and the rotation are read through RPCs only. No policies, no direct access — the same
-- treatment kinetype.cosmetics gets.
revoke all on kinetype.quest_defs        from anon, authenticated, public;
revoke all on kinetype.quest_weekly_sets from anon, authenticated, public;

-- Own awards only, read-only. There is deliberately NO write path from a client: an award is
-- minted inside quest_award(), which the client cannot reach.
drop policy if exists kt_quest_awards_select_own on kinetype.quest_awards;
create policy kt_quest_awards_select_own on kinetype.quest_awards
  for select using (auth.uid() = user_id);
revoke insert, update, delete on kinetype.quest_awards from anon, authenticated, public;

-- INTERNAL FUNCTIONS MUST NOT BE PUBLIC. Postgres grants EXECUTE to PUBLIC on every new function by
-- default, which would put quest_award() (a reward-minting write) and quest_progress_value() (which
-- takes any user id) on the API. Revoked, and the SECURITY DEFINER callers above still reach them
-- because the owner always can.
revoke all on function kinetype.quest_award(uuid, timestamptz)                            from public, anon, authenticated;
revoke all on function kinetype.quest_progress_value(text, numeric, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- Public, read-only surface: the day's rotation, the quest book, and the caller's own progress.
grant execute on function kinetype.quest_plan(date)      to anon, authenticated;
grant execute on function kinetype.quest_catalog()       to anon, authenticated;
grant execute on function kinetype.quest_ids_for(date)   to anon, authenticated;
grant execute on function kinetype.my_quests(timestamptz) to authenticated;
grant execute on function kinetype.active_quests(timestamptz) to authenticated;

-- Unchanged, but re-stated because a DROP anywhere above would silently hand the grant back.
grant execute on function kinetype.submit_match(text,text,integer,boolean,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function kinetype.leaderboard(text,integer) to anon, authenticated;

commit;
