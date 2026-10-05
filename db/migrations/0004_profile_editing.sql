-- 0004_profile_editing.sql
--
-- Let a player change their own NAME and PROFILE PICTURE.
--
-- Until now the only way those two fields ever got a value was the OAuth handshake: on first
-- sign-in `ensure_profile()` copied `full_name`/`name`/`avatar_url` out of the provider metadata.
-- There was no path back for the player — a Google display name or a photo they no longer wanted
-- was permanent, and there was nowhere in the UI to change either.
--
-- Two things were missing.
--
--   1. A WRITER. Every write in this schema goes through a SECURITY DEFINER RPC (`set_loadout`,
--      `submit_match`, …) rather than a table update from the client, so name/avatar need one
--      too. `update_profile()` is that writer and it is the ONLY thing allowed to set these two
--      columns after sign-up.
--
--   2. SOMEWHERE TO PUT AN UPLOADED IMAGE. `avatar_url` is a text column and the CSP allows
--      images from any https origin, so any URL would render — including a third-party tracking
--      pixel that fires for every player who views the profile. An uploaded avatar therefore
--      needs BOTH a bucket to live in AND a server-side check that the URL we store really
--      points at that bucket. Without the check, "change your picture" is an open redirect for
--      other people's browsers.
--
-- WHY THE STORAGE FOLDER IS THE HANDLE AND NOT THE USER ID
--
-- The obvious namespace is `<user_id>/avatar.webp` — the uid is already in hand on the client and
-- `auth.uid()` is the natural RLS predicate. It is the WRONG choice here, and it was caught by the
-- verification probe rather than by eye: a public object's URL CONTAINS its path, so the moment a
-- profile rendered an avatar, the player's auth UUID was published in the HTML of every profile
-- page AND in every row of the leaderboard RPC's payload. That is exactly the leak migration 0003
-- was written to close (it dropped `user_id` from the leaderboard and introduced `handle` so that
-- "a profile URL does not spread an auth identifier around the web").
--
-- So objects are namespaced by the profile's public, immutable `handle` instead:
--     kinetype-avatars/<handle>/avatar.webp
-- An avatar is public by definition, so the handle appears in a place that is already public and
-- the uuid stays out of it. The handle never changes, so the folder never moves.
--
-- Idempotent. Safe to re-run. Does not touch Streakly in the `public` schema.

-- ============================================================================ bucket
-- A dedicated, PUBLIC-readable bucket. Public is required: an avatar is rendered by `<img>` on
-- other people's browsers, and a signed URL would expire out from under them.
--
-- A SHARED project detail worth knowing: storage buckets are GLOBAL to the Supabase project, not
-- scoped to the `kinetype` schema (the storage schema is its own thing). Streakly lives in the
-- same project, so this bucket is named for its owner and every policy below is keyed on
-- `bucket_id = 'kinetype-avatars'`. No policy here can match a Streakly object.
--
-- file_size_limit and allowed_mime_types are belt-and-braces: the browser already downscales to a
-- 256px WebP (a few KB), so these caps exist to bound what a hand-rolled upload can push.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kinetype-avatars',
  'kinetype-avatars',
  true,
  1048576, -- 1 MiB
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ===================================================================== storage policies
-- Objects are namespaced `<handle>/avatar.webp`. Every write policy demands that the FIRST path
-- segment is the CALLER'S OWN handle, so a player can only ever write inside their own folder —
-- they cannot overwrite or delete somebody else's face.
--
-- `storage.foldername(name)` returns the path split on '/', so `[1]` is the leading folder. The
-- subquery reads `kinetype.profiles`, which is own-row-only under RLS — and it is filtered on
-- `id = auth.uid()`, so the policy sees its own row and nothing else.
drop policy if exists kinetype_avatars_read   on storage.objects;
drop policy if exists kinetype_avatars_insert on storage.objects;
drop policy if exists kinetype_avatars_update on storage.objects;
drop policy if exists kinetype_avatars_delete on storage.objects;

-- Read is public (the bucket is public); this policy exists so the authenticated SDK can list
-- and so an upsert can see the object it is replacing.
create policy kinetype_avatars_read on storage.objects
  for select
  using (bucket_id = 'kinetype-avatars');

create policy kinetype_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kinetype-avatars'
    and (storage.foldername(name))[1] = (
      select p.handle from kinetype.profiles p where p.id = auth.uid()
    )
  );

-- Upsert (replacing your own face) needs UPDATE as well as INSERT.
create policy kinetype_avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'kinetype-avatars'
    and (storage.foldername(name))[1] = (
      select p.handle from kinetype.profiles p where p.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'kinetype-avatars'
    and (storage.foldername(name))[1] = (
      select p.handle from kinetype.profiles p where p.id = auth.uid()
    )
  );

create policy kinetype_avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'kinetype-avatars'
    and (storage.foldername(name))[1] = (
      select p.handle from kinetype.profiles p where p.id = auth.uid()
    )
  );

-- ================================================================= update_profile()
-- The single writer for `display_name` and `avatar_url`. Both arguments are OPTIONAL and a NULL
-- means "leave this one alone", so a partial update works from either field.
--
-- `p_avatar_url = ''` is the explicit "I have no photo" state, and it is a deliberate sentinel
-- rather than NULL. `ensure_profile()` runs on every profile load and fills a NULL avatar from
-- the OAuth metadata (`coalesce(profiles.avatar_url, excluded.avatar_url)`) — so storing NULL
-- here would let a CLEARED photo silently come back on the next page load. An empty string is
-- not NULL, survives that coalesce, and the UI reads it as "no photo" (falsy) either way.
--
-- THE HANDLE IS NOT TOUCHED. It is the profile's public address and is assigned once; renaming
-- yourself must not move it out from under a link somebody already shared. A rename changes what
-- people read, not where they find you.
create or replace function kinetype.update_profile(
  p_display_name text default null,
  p_avatar_url   text default null
) returns kinetype.profiles
language plpgsql security definer set search_path = kinetype, public
as $$
declare
  -- Long enough for a real name, short enough that it cannot wreck a leaderboard row or a
  -- header chip. Measured in characters, not bytes, so accented and non-Latin names are not
  -- penalised for being multi-byte.
  C_NAME_MAX constant integer := 24;

  v_uid    uuid := auth.uid();
  v_name   text;
  v_av     text;
  v_handle text;
  v_row    kinetype.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.handle into v_handle from kinetype.profiles p where p.id = v_uid;
  if v_handle is null then
    -- ensure_profile() always creates the row before this can be reached; the guard exists so a
    -- NULL handle can never be concatenated into the URL pattern below and match everything.
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------- display name
  if p_display_name is not null then
    v_name := coalesce(p_display_name, '');
    -- Control characters (newlines, tabs, zero-width joiners) would corrupt a single-line
    -- leaderboard row; angle brackets are stripped so a name is never confused with markup if
    -- it is ever rendered somewhere that does not escape — a future email template, an OG tag.
    v_name := regexp_replace(v_name, '[[:cntrl:]<>]', '', 'g');
    -- Collapse runs of whitespace to one space, then trim the ends.
    v_name := regexp_replace(v_name, '\s+', ' ', 'g');
    v_name := btrim(v_name);

    if length(v_name) < 1 then
      raise exception 'Your name cannot be empty.' using errcode = 'P0001';
    end if;

    v_name := left(v_name, C_NAME_MAX);
  end if;

  -- ---------------------------------------------------------------- avatar url
  if p_avatar_url is not null then
    v_av := btrim(p_avatar_url);

    if v_av <> '' and v_av !~ (
      '^https://[a-z0-9-]+\.supabase\.(co|in)/storage/v1/object/public/'
      || 'kinetype-avatars/' || v_handle || '/[A-Za-z0-9._-]+(\?[^\s]*)?$'
    ) then
      -- Refused rather than stored: any other URL could be a tracking pixel pointed at every
      -- player who opens the profile. The optional query string is the cache-buster the client
      -- appends, hence `(\?[^\s]*)?`.
      raise exception 'Avatar must be an image you uploaded to Kinetype.' using errcode = 'P0001';
    end if;
  end if;

  update kinetype.profiles p set
    display_name = coalesce(v_name, p.display_name),
    avatar_url   = coalesce(v_av,   p.avatar_url),
    updated_at   = now()
  where p.id = v_uid;

  select * into v_row from kinetype.profiles where id = v_uid;
  return v_row;
end $$;

grant execute on function kinetype.update_profile(text, text) to authenticated;

-- ============================================ note: ensure_profile() is deliberately NOT changed
-- It is tempting to also patch `ensure_profile()` here, but it needs no change and touching it
-- would be a silent risk for nothing. Its on-conflict does:
--     display_name = coalesce(profiles.display_name, excluded.display_name),
--     avatar_url   = coalesce(profiles.avatar_url,   excluded.avatar_url)
-- i.e. it only ever fills a NULL. Because `update_profile` CLEARS a photo to '' rather than to
-- NULL, a removed photo is no longer NULL and so the coalesce leaves it removed. A rename is
-- likewise safe: `display_name` is non-NULL once set, so OAuth can never overwrite it either.
