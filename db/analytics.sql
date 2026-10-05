-- Kinetype first-party analytics.
--
-- Design notes:
--  * Table is RLS-locked with NO policies: anon/authenticated cannot read or write it
--    directly. The only door in is kinetype.log_events(), a SECURITY DEFINER RPC that
--    validates every field and clamps every length, so a hostile client can at worst
--    add junk analytics rows -- never read other data, never write another table.
--  * No IP addresses are stored. Country/region arrive from Vercel's geo headers.
--  * No PII: session_id is a random per-tab id, anon_id a random per-browser id.

create table if not exists kinetype.analytics_events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  session_id   text not null,
  anon_id      text,
  user_id      uuid,
  event        text not null,
  path         text,
  referrer     text,
  ref_domain   text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  device       text,
  country      text,
  region       text,
  props        jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_idx on kinetype.analytics_events (created_at desc);
create index if not exists analytics_events_event_idx   on kinetype.analytics_events (event, created_at desc);
create index if not exists analytics_events_session_idx on kinetype.analytics_events (session_id);
create index if not exists analytics_events_path_idx    on kinetype.analytics_events (path);

alter table kinetype.analytics_events enable row level security;
revoke all on kinetype.analytics_events from anon, authenticated;

create or replace function kinetype.log_events(
  events  jsonb,
  country text default null,
  region  text default null,
  device  text default null
) returns integer
language plpgsql
security definer
set search_path = kinetype, pg_temp
as $$
declare
  n   integer := 0;
  e   jsonb;
  ev  text;
  uid text;
  p   jsonb;
begin
  if events is null or jsonb_typeof(events) <> 'array' then
    raise exception 'events must be a JSON array';
  end if;
  if jsonb_array_length(events) > 25 then
    raise exception 'batch too large (max 25)';
  end if;

  for e in select jsonb_array_elements(events) loop
    ev := left(coalesce(e->>'event', ''), 40);
    -- Strict name shape, PostHog-compatible: an optional `$` prefix then lowercase
    -- snake_case. Anything else is silently dropped.
    if ev !~ '^\$?[a-z0-9_]{1,40}$' then
      continue;
    end if;

    -- Optional signed-in attribution. Format-checked, never trusted blindly.
    uid := nullif(e->>'user_id', '');
    if uid is not null and uid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      uid := null;
    end if;

    -- Props are free-form but capped, so one event cannot bloat the table.
    p := coalesce(e->'props', '{}'::jsonb);
    if jsonb_typeof(p) <> 'object' or octet_length(p::text) > 2000 then
      p := '{}'::jsonb;
    end if;

    insert into kinetype.analytics_events (
      session_id, anon_id, user_id, event, path, referrer, ref_domain,
      utm_source, utm_medium, utm_campaign, country, region, device, props
    ) values (
      left(coalesce(nullif(e->>'session_id', ''), 'unknown'), 64),
      left(nullif(e->>'anon_id', ''), 64),
      uid::uuid,
      ev,
      left(nullif(e->>'path', ''), 200),
      left(nullif(e->>'referrer', ''), 300),
      left(nullif(e->>'ref_domain', ''), 120),
      left(nullif(e->>'utm_source', ''), 80),
      left(nullif(e->>'utm_medium', ''), 80),
      left(nullif(e->>'utm_campaign', ''), 80),
      left(coalesce(nullif(country, ''), nullif(e->>'country', '')), 2),
      left(nullif(region, ''), 80),
      left(nullif(device, ''), 16),
      p
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function kinetype.log_events(jsonb, text, text, text) from public;
grant execute on function kinetype.log_events(jsonb, text, text, text) to anon, authenticated;

-- Read models for the Supabase SQL editor / dashboard.
-- security_invoker = true so the caller's RLS applies; with no read policy on the base
-- table these return zero rows through the public API and the real numbers only to a
-- privileged role (postgres in the editor, service_role in reports).
create or replace view kinetype.analytics_daily
with (security_invoker = true) as
select
  (created_at at time zone 'Africa/Johannesburg')::date              as day,
  count(*) filter (where event = '$pageview')                        as pageviews,
  count(distinct session_id)                                          as sessions,
  count(distinct coalesce(anon_id, session_id))                       as visitors,
  count(*) filter (where event = 'game_start')                        as game_starts,
  count(*) filter (where event = 'match_end')                         as matches_finished,
  count(*) filter (where event = 'typing_test_end')                   as typing_tests,
  count(*) filter (where event = 'sign_in')                           as sign_ins
from kinetype.analytics_events
group by 1
order by 1 desc;

create or replace view kinetype.analytics_pages
with (security_invoker = true) as
select
  path,
  count(*) filter (where event = '$pageview')        as pageviews,
  count(distinct session_id)                          as sessions,
  max(created_at)                                     as last_seen
from kinetype.analytics_events
where event = '$pageview'
group by 1
order by pageviews desc;
