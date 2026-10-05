-- 0005_coins.sql
--
-- Move the coin economy onto the profile, so coins are the ACCOUNT's, not this browser's.
--
-- Until now `game/storage.ts` kept `coins`, `ownedSkins` and `ownedThemes` in localStorage and
-- `game/commerce.ts` decided purchases in the browser. That meant: clearing site data lost every
-- coin; a second device started at zero; and the owned lists pushed to the server were
-- SELF-REPORTED (`set_loadout` wrote whatever the client sent, and said so in a comment). Coins
-- are not money yet — `REAL_MONEY_ENABLED` is false — but they are the currency the whole shop is
-- priced in, so the same rule the rest of this schema already follows now applies to them: the
-- server decides, the client displays.
--
-- THREE PIECES:
--
--   1. `profiles.coins` — the balance lives on the account row.
--   2. Awarding is server-side, inside `submit_match()`, from inputs it already receives. The
--      client formula in game/match.ts:805 is mirrored by `coins_for_match()` below, CLAMPED the
--      same way `xp_for_match()` is, so a tampered payload cannot inflate a payout.
--   3. Spending is `purchase_cosmetic()`, which looks the price up in `cosmetics` — the client
--      never sends a price, so nobody buys the 900-coin skin for 1.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: there is no "import my localStorage coins" call. A
-- client-asserted balance is exactly the self-reported hole being closed, so an account wallet
-- starts at 0 and local play keeps its own separate guest wallet. Chosen knowingly over a
-- one-time capped merge.
--
-- `set_loadout()` is DROPPED. Owned cosmetics are now server-owned, so a client that could write
-- them could mint 900-coin skins for free. `set_equipped()` replaces it and will only wear an item
-- the player already OWNS — the ownership lists themselves have no client write path any more.
-- (Transitional note: until the matching front end is deployed, the live bundle still calls
-- `set_loadout` and gets a 404. That call has always been wrapped in a catch, and its only effect
-- was cosmetic, so the window is harmless and self-heals on deploy.)
--
-- Idempotent. Safe to re-run. Does not touch Streakly in the `public` schema.

-- =========================================================================== the balance
alter table kinetype.profiles add column if not exists coins integer not null default 0;
-- Added separately so the constraint is created even on a table that already had the column.
alter table kinetype.profiles drop constraint if exists kt_profiles_coins_nonneg;
alter table kinetype.profiles add constraint kt_profiles_coins_nonneg check (coins >= 0);

-- =================================================================== the price book
-- Server-side prices. `game/skins.ts` and `game/themes.ts` still hold the copy the SHOP RENDERS
-- (names, blurbs, sprites, prices), so the two must agree — scripts/probe-cosmetics.ts asserts
-- every id and price here against the TypeScript constants and fails loudly on drift. Prices are
-- read-only to clients; only `purchase_cosmetic()` and `cosmetic_catalog()` touch this table.
create table if not exists kinetype.cosmetics (
  kind  text    not null check (kind in ('skin', 'theme')),
  id    text    not null,
  price integer not null check (price >= 0),
  primary key (kind, id)
);

insert into kinetype.cosmetics (kind, id, price) values
  ('skin', 'spark',          0),
  ('skin', 'ember',        120),
  ('skin', 'tide',         120),
  ('skin', 'monolith',     320),
  ('skin', 'violet-static',320),
  ('skin', 'voidwing',     900),
  ('theme', 'paper',         0),
  ('theme', 'midnight',    200),
  ('theme', 'sunset',      300),
  ('theme', 'frost',       300),
  ('theme', 'neon',        650),
  ('theme', 'volcano',     900)
on conflict (kind, id) do update set price = excluded.price;

-- Boss first-clear coin bounties. `game/progression.ts` carries the same numbers (and the same
-- drift guard as above). Kept in a table rather than inline in the function so the probe can read
-- them back and compare.
create table if not exists kinetype.boss_rewards (
  boss_id text    primary key,
  coins   integer not null check (coins >= 0)
);

insert into kinetype.boss_rewards (boss_id, coins) values
  ('tick',      25),
  ('bandit',    40),
  ('vex',       60),
  ('havoc',     85),
  ('quartz',   115),
  ('cannon',   150),
  ('nimbus',   200),
  ('vortex',   260),
  ('oblivion', 400)
on conflict (boss_id) do update set coins = excluded.coins;

alter table kinetype.cosmetics     enable row level security;
alter table kinetype.boss_rewards  enable row level security;
-- No policies: unreachable directly. `cosmetic_catalog()` is the only read path.
revoke all on kinetype.cosmetics    from anon, authenticated;
revoke all on kinetype.boss_rewards from anon, authenticated;

-- ==================================================================== coins_for_match()
-- MIRRORS game/match.ts:finish() ONE-FOR-ONE, with the same clamps `xp_for_match()` applies.
-- The client version is not clamped because it only ever sees the engine's own numbers; this one
-- guards a payload a hostile client controls, so the two agree on every legitimate match and this
-- one refuses to be inflated.
create or replace function kinetype.coins_for_match(
  p_won        boolean,
  p_rounds_won integer,
  p_wpm        numeric,
  p_accuracy   numeric,
  p_streak     integer
) returns integer
language sql immutable set search_path = pg_catalog
as $$
  select greatest(0,
      (case when p_won then 40 else 12 end)
    + least(5, greatest(0, p_rounds_won)) * 10
    + round(least(400, greatest(0, p_wpm))::numeric * 0.6)
    + round(least(100, greatest(0, p_accuracy))::numeric / 100.0 * 30)
    + least(5, greatest(0, p_streak)) * 8
  )::integer;
$$;

-- ==================================================================== submit_match()
-- Replaced to pay coins as well as XP: the base payout for every match, plus a boss's bounty the
-- first time it is cleared. The throttle and the daily ceiling are unchanged, and the ceiling now
-- stops COINS as well as XP — a capped farm pays nothing at all.
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
  C_MAX_MATCHES_PER_MIN constant integer := 12;
  C_DAILY_XP_CAP        constant integer := 25000;

  v_uid       uuid := auth.uid();
  v_first     boolean := false;
  v_boss_pay  integer := 0;
  v_xp        integer;
  v_coins     integer;
  v_recent    integer;
  v_today_xp  integer;
  v_row       kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform kinetype.ensure_profile();

  select count(*) into v_recent
  from kinetype.matches m
  where m.user_id = v_uid and m.created_at > now() - interval '60 seconds';

  if v_recent >= C_MAX_MATCHES_PER_MIN then
    raise exception 'Too many matches submitted at once. Wait a moment and try again.'
      using errcode = 'P0001';
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

  select coalesce(sum(m.xp_awarded), 0) into v_today_xp
  from kinetype.matches m
  where m.user_id = v_uid
    and m.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_today_xp >= C_DAILY_XP_CAP then
    v_xp    := 0;
    v_coins := 0;
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
    coins         = p.coins + v_coins,
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

-- ==================================================================== purchase_cosmetic()
-- Buy a skin or theme with the ACCOUNT's coins. The price comes from `cosmetics`, never from the
-- caller, and the debit is one statement guarded by `coins >= price` — so two clicks racing each
-- other cannot both pass a balance check, and the balance can never go negative.
create or replace function kinetype.purchase_cosmetic(
  p_kind text,
  p_id   text
) returns kinetype.profiles
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_uid   uuid := auth.uid();
  v_price integer;
  v_row   kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_kind is null or p_kind not in ('skin', 'theme') then
    raise exception 'Unknown item type.' using errcode = 'P0001';
  end if;

  select c.price into v_price
  from kinetype.cosmetics c
  where c.kind = p_kind and c.id = p_id;

  if v_price is null then
    raise exception 'That item does not exist.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from kinetype.profiles p
    where p.id = v_uid
      and p_id = any(case when p_kind = 'skin' then p.owned_skins else p.owned_themes end)
  ) then
    raise exception 'You already own that.' using errcode = 'P0001';
  end if;

  update kinetype.profiles p set
    coins        = p.coins - v_price,
    owned_skins  = case when p_kind = 'skin'
                        then (select array_agg(distinct x order by x) from unnest(p.owned_skins || p_id) x)
                        else p.owned_skins end,
    owned_themes = case when p_kind = 'theme'
                        then (select array_agg(distinct x order by x) from unnest(p.owned_themes || p_id) x)
                        else p.owned_themes end,
    -- Buying it wears it, which is what the shop has always done.
    equipped_skin  = case when p_kind = 'skin'  then p_id else p.equipped_skin  end,
    equipped_theme = case when p_kind = 'theme' then p_id else p.equipped_theme end,
    updated_at = now()
  where p.id = v_uid
    and p.coins >= v_price;

  if not found then
    raise exception 'Not enough coins yet.' using errcode = 'P0001';
  end if;

  select * into v_row from kinetype.profiles where id = v_uid;
  return v_row;
end $$;

-- ======================================================================= set_equipped()
-- Wear a cosmetic you own. This is the ONLY thing a client may change about cosmetics now: the
-- owned lists are written by `purchase_cosmetic()` and by nothing else. An id the player does not
-- own is IGNORED rather than raised, so a stale or hostile client cannot wedge the equipped state.
create or replace function kinetype.set_equipped(
  p_skin  text,
  p_theme text
) returns void
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update kinetype.profiles p set
    equipped_skin  = case when p_skin  is not null and p_skin  = any(p.owned_skins)  then p_skin  else p.equipped_skin  end,
    equipped_theme = case when p_theme is not null and p_theme = any(p.owned_themes) then p_theme else p.equipped_theme end,
    updated_at = now()
  where p.id = v_uid;
end $$;

-- ================================================================== cosmetic_catalog()
-- The price book, readable so tooling (and any future shop screen) can show exactly what the
-- server will charge. Read-only and secret-free.
create or replace function kinetype.cosmetic_catalog()
returns table (kind text, id text, price integer)
language sql stable security definer set search_path = kinetype, public
as $$
  select c.kind, c.id, c.price from kinetype.cosmetics c order by c.kind, c.id;
$$;

drop function if exists kinetype.set_loadout(text, text, text[], text[]);

-- ============================================================================ grants
grant execute on function kinetype.submit_match(text,text,integer,boolean,numeric,numeric,integer,integer,integer,integer) to authenticated;
grant execute on function kinetype.purchase_cosmetic(text, text) to authenticated;
grant execute on function kinetype.set_equipped(text, text)             to authenticated;
grant execute on function kinetype.cosmetic_catalog()                  to anon, authenticated;
