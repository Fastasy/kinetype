-- Kinetype security hardening — 2026-10-05.
--
-- Findings this closes (all reproduced against the live project first):
--
--  1. `kt_profiles_select USING (true)` exposed EVERY column of EVERY profile to
--     anyone holding the anon key — including auth users' UUIDs, and including rows
--     for players who had set show_on_leaderboard = false. The opt-out was decorative.
--     Fixed: own-row reads only. The public board goes through the SECURITY DEFINER
--     leaderboard() RPC, which already respects show_on_leaderboard and returns only
--     the columns a board needs.
--
--  2. `submit_match()` had no throttle. Measured: 20 forged matches in 5.2 seconds
--     took a brand-new account to 4 040 XP / level 7. A human cannot finish a match
--     faster than the round countdowns allow, so a per-minute cap is free to enforce
--     and invisible to legitimate play. A daily XP ceiling bounds a slow farm.
--     NOTE this does not make the board cheat-PROOF: the match is simulated on the
--     client, so a determined attacker can still submit plausible-looking wins. Real
--     anti-cheat needs server-side simulation or replay validation. This bounds the
--     damage and makes bulk farming impractical.
--
--  3. xp_for_match() carried no search_path. It is SECURITY INVOKER and uses only
--     pg_catalog builtins, so it is not currently exploitable — the explicit
--     search_path is defence in depth so it stays that way if the body changes.
--
-- Idempotent. Safe to re-run.

-- ============================================================ 1. profile privacy
drop policy if exists kt_profiles_select on kinetype.profiles;
drop policy if exists kt_profiles_select_own on kinetype.profiles;

-- Own row only. Anon (auth.uid() is null) matches nothing.
create policy kt_profiles_select_own on kinetype.profiles
  for select using (auth.uid() = id);

-- Anon has no business reading the table directly at all; the board is an RPC.
revoke select on kinetype.profiles from anon;

-- ==================================================== 2. submit_match with limits
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
  -- A real match cannot end sooner than its countdowns allow, so 12 per minute is
  -- several times the fastest a human can legitimately produce.
  C_MAX_MATCHES_PER_MIN constant integer := 12;
  -- Generous ceiling on paid XP per UTC day. Bounds a patient farm; far above any
  -- realistic human session. Matches past the cap are still RECORDED, just unpaid,
  -- so a legitimate heavy day never sees an error.
  C_DAILY_XP_CAP        constant integer := 25000;

  v_uid       uuid := auth.uid();
  v_first     boolean := false;
  v_xp        integer;
  v_recent    integer;
  v_today_xp  integer;
  v_row       kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform kinetype.ensure_profile();

  -- throttle: count matches in the last 60 seconds
  select count(*) into v_recent
  from kinetype.matches m
  where m.user_id = v_uid and m.created_at > now() - interval '60 seconds';

  if v_recent >= C_MAX_MATCHES_PER_MIN then
    -- P0001 maps to HTTP 400 in PostgREST; an unmapped code would surface as a 500
    -- and read like a server crash rather than a refusal.
    raise exception 'Too many matches submitted at once. Wait a moment and try again.'
      using errcode = 'P0001';
  end if;

  if p_mode = 'boss' and p_boss_id is not null and coalesce(p_won, false) then
    select not exists (
      select 1 from kinetype.boss_clears b
      where b.user_id = v_uid and b.boss_id = p_boss_id
    ) into v_first;
  end if;

  v_xp := kinetype.xp_for_match(
    coalesce(p_won, false), coalesce(p_rounds_won, 0), coalesce(p_wpm, 0),
    coalesce(p_accuracy, 0), coalesce(p_streak, 0), coalesce(p_mode, 'free'), v_first);

  -- daily ceiling: stop PAYING, never stop RECORDING
  select coalesce(sum(m.xp_awarded), 0) into v_today_xp
  from kinetype.matches m
  where m.user_id = v_uid
    and m.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_today_xp >= C_DAILY_XP_CAP then
    v_xp := 0;
  end if;

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

-- ==================================================== 3. xp_for_match hardening
-- Behaviour is unchanged: same expression, same result. Only the search_path is
-- pinned so an unqualified name added later cannot resolve outside pg_catalog.
create or replace function kinetype.xp_for_match(
  p_won          boolean,
  p_rounds_won   integer,
  p_wpm          numeric,
  p_accuracy     numeric,
  p_streak       integer,
  p_mode         text,
  p_boss_cleared boolean
) returns integer
language sql immutable set search_path = pg_catalog
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

-- grants unchanged
grant execute on function kinetype.submit_match(text,text,integer,boolean,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function kinetype.leaderboard(text,integer) to anon, authenticated;
