"use client";

// Your account: change the name and photo other players see.
//
// The signed-in player is the only person who can reach this, and it writes through
// `update_profile()` — the ONE server path that may set these two columns after sign-up.
// The handle is shown but not editable: it is the profile's public address, assigned once, and
// a rename must not move it out from under a link somebody already shared.
//
// No effects: the name field is a DRAFT that falls back to the profile, so it needs no
// setState-in-effect sync when the profile arrives. React 19 rejects that pattern, and this
// avoids it rather than suppressing the rule.

import { useRef, useState } from "react";
import Link from "next/link";

import { signInHref, useAuth } from "@/components/auth/AuthProvider";
import { updateProfile } from "@/lib/kinetype-db";
import {
  AVATAR_ACCEPT,
  isSupportedAvatarFile,
  removeAvatar,
  uploadAvatar,
} from "@/lib/avatars";

/** Longest name the server will keep. Mirrored on the input so the clamp is visible up front. */
const NAME_MAX = 24;

type Notice = { kind: "ok" | "err"; text: string };

/** Pull the server's own message out (the RPC raises readable ones) instead of a generic banner. */
function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (err instanceof Error && err.message) return err.message;
  return "That did not work. Try again in a moment.";
}

function Notice({ notice }: { notice: Notice }) {
  return (
    <p
      role="status"
      data-testid="settings-status"
      className={`border-2 px-3 py-2 text-sm ${
        notice.kind === "err" ? "border-heat bg-heat-deep text-heat" : "border-brand bg-brand-deep text-ink"
      }`}
    >
      {notice.text}
    </p>
  );
}

export default function AccountSettings() {
  const { configured, ready, userId, profile, profileLoading, signInWithGoogle, refreshProfile } =
    useAuth();

  // null == "show what the server has". Typing sets a draft; saving clears it again.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  if (!configured) {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-8 text-center text-sm text-ink-faint">
        Accounts are not configured on this deployment, so there is nothing to edit yet.
      </p>
    );
  }

  if (!ready) {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-8 text-center text-sm text-ink-faint">
        Checking your account…
      </p>
    );
  }

  if (!userId) {
    return (
      <div className="border-2 border-line bg-card/50 px-4 py-8 text-center" data-testid="settings-signed-out">
        <p className="font-pixel text-sm text-ink">Sign in to make it yours</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-faint">
          A name and a photo belong to an account. Make one with an email address and they follow
          you to any device.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href={signInHref("/settings")}
            data-testid="settings-signin-email"
            className="border-2 border-brand bg-brand px-4 py-2 text-sm font-bold text-brand-deep transition hover:bg-brand-bright"
          >
            Sign in or create an account
          </Link>
          <button
            type="button"
            disabled={signingIn}
            onClick={async () => {
              setSigningIn(true);
              setNotice(null);
              try {
                await signInWithGoogle("/settings");
              } catch (err) {
                setNotice({ kind: "err", text: errorMessage(err) });
                setSigningIn(false);
              }
            }}
            data-testid="settings-signin-google"
            className="border-2 border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </button>
        </div>
        {notice && (
          <div className="mt-3">
            <Notice notice={notice} />
          </div>
        )}
      </div>
    );
  }

  // The form is gated on the PROFILE, not just the session. Rendering it while the profile is
  // still in flight shows an empty name box that then fills itself in underneath the player —
  // and anything they typed in that window is silently overwritten when the read lands.
  if (!profile) {
    if (profileLoading) {
      return (
        <p className="border-2 border-line bg-card/50 px-4 py-8 text-center text-sm text-ink-faint">
          Checking your account…
        </p>
      );
    }
    // Not loading and still no row: the read failed. The provider logs it and retries on the
    // next auth event, but offer a manual retry rather than spinning forever.
    return (
      <div className="border-2 border-line bg-card/50 px-4 py-8 text-center" data-testid="settings-no-profile">
        <p className="font-pixel text-sm text-ink">We could not load your account</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-faint">
          Your progress is safe — this is just the settings panel failing to read it.
        </p>
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try {
              await refreshProfile();
            } finally {
              setRetrying(false);
            }
          }}
          className="mt-5 border-2 border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {retrying ? "Trying…" : "Try again"}
        </button>
      </div>
    );
  }

  const savedName = profile?.display_name ?? "";
  const nameValue = draftName ?? savedName;
  const trimmed = nameValue.trim();
  const nameChanged = trimmed.length > 0 && trimmed !== savedName;
  const initial = (savedName || profile.handle || "Player").slice(0, 1).toUpperCase();

  // The bucket namespaces objects by the PUBLIC handle, not the auth uuid: an object's URL
  // contains its path, so a uid-based folder would publish an auth identifier on every profile
  // page and every leaderboard row. See db/migrations/0004_profile_editing.sql.
  const avatarHandle = profile.handle;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameChanged || savingName) return;
    setSavingName(true);
    setNotice(null);
    try {
      await updateProfile({ displayName: trimmed });
      // Re-read rather than trusting the input: the server trims, collapses whitespace and
      // clamps the length, and the field should show what was actually stored.
      await refreshProfile();
      setDraftName(null);
      setNotice({ kind: "ok", text: "Name saved." });
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
    } finally {
      setSavingName(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear the input so picking the SAME file twice still fires a change event.
    e.target.value = "";
    if (!file) return;

    setNotice(null);
    if (!isSupportedAvatarFile(file)) {
      setNotice({ kind: "err", text: "Use a PNG, JPEG or WebP image." });
      return;
    }

    setBusyPhoto(true);
    try {
      // Up to a few KB leaves the browser — downscaled to a 256px square first.
      const url = await uploadAvatar(avatarHandle, file);
      await updateProfile({ avatarUrl: url });
      await refreshProfile();
      setNotice({ kind: "ok", text: "Photo updated." });
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
    } finally {
      setBusyPhoto(false);
    }
  }

  async function removePhoto() {
    setNotice(null);
    setBusyPhoto(true);
    try {
      // Clear the profile FIRST, so the picture is gone even if the storage cleanup fails.
      await updateProfile({ avatarUrl: "" });
      try {
        await removeAvatar(avatarHandle);
      } catch {
        // An orphaned object costs a few KB and nothing reads it. Not worth an error banner.
      }
      await refreshProfile();
      setNotice({ kind: "ok", text: "Photo removed." });
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
    } finally {
      setBusyPhoto(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="account-settings">
      {/* ------------------------------------------------------------------- photo */}
      <section className="border-2 border-line bg-card/50 p-4 sm:p-5">
        <h2 className="font-pixel text-sm text-ink">Profile picture</h2>
        <p className="mt-1 text-[11px] text-ink-faint">
          Shown next to your name on the leaderboard and on your public profile. Anything you pick
          is cropped square and shrunk before it is uploaded.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              data-testid="avatar-preview"
              className="h-16 w-16 rounded-full border-2 border-line object-cover"
            />
          ) : (
            <span
              data-testid="avatar-preview"
              data-empty="true"
              className="grid h-16 w-16 place-items-center rounded-full border-2 border-line bg-page font-pixel text-lg text-ink"
            >
              {initial}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ACCEPT}
              onChange={onPickFile}
              data-testid="avatar-input"
              className="sr-only"
            />
            <button
              type="button"
              disabled={busyPhoto}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-line-strong bg-card px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {busyPhoto ? "Working…" : profile?.avatar_url ? "Change photo" : "Upload photo"}
            </button>

            {profile?.avatar_url ? (
              <button
                type="button"
                disabled={busyPhoto}
                onClick={() => void removePhoto()}
                data-testid="remove-photo"
                className="px-3 py-2 text-sm font-medium text-ink-faint transition hover:text-heat disabled:opacity-60"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- name */}
      <section className="border-2 border-line bg-card/50 p-4 sm:p-5">
        <h2 className="font-pixel text-sm text-ink">Display name</h2>
        <p className="mt-1 text-[11px] text-ink-faint">
          The name other players see. Up to {NAME_MAX} characters.
        </p>

        <form onSubmit={saveName} className="mt-4 flex flex-wrap items-start gap-2">
          <label className="sr-only" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            name="display-name"
            value={nameValue}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            onChange={(e) => setDraftName(e.target.value)}
            data-testid="name-input"
            className="min-w-0 flex-1 border-2 border-line bg-page px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
          />
          <button
            type="submit"
            disabled={!nameChanged || savingName}
            data-testid="save-name"
            className="border-2 border-brand bg-brand px-4 py-2 text-sm font-bold text-brand-deep transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line-strong disabled:text-ink-faint"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </form>
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          {nameValue.length}/{NAME_MAX}
        </p>
      </section>

      {/* ------------------------------------------------------------------ handle */}
      <section className="border-2 border-line bg-card/50 p-4 sm:p-5">
        <h2 className="font-pixel text-sm text-ink">Your profile address</h2>
        <p className="mt-1 text-[11px] text-ink-faint">
          This is fixed. It is how other players find you, and a link you have already shared
          should keep working.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {profile?.handle ? (
            <>
              <span className="border-2 border-line bg-page px-3 py-2 font-mono text-sm text-ink-soft">
                @{profile.handle}
              </span>
              <Link
                href={`/u/${profile.handle}`}
                className="text-sm font-semibold text-brand transition hover:text-brand-bright"
              >
                View your public profile →
              </Link>
            </>
          ) : (
            <span className="font-mono text-sm text-ink-faint">—</span>
          )}
        </div>
      </section>

      {notice && <Notice notice={notice} />}
    </div>
  );
}
