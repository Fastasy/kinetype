"use client";

// Change the password on the signed-in account.
//
// This exists because the mailer is the weak link: the password-reset email goes through Supabase's
// built-in service, which caps auth email at 2 an hour PROJECT-WIDE, and this project has no custom
// SMTP. Changing a password while signed in needs no email at all, so it is the recovery path that
// always works.
//
// Google-only accounts have no password yet. The server accepts the first one just the same, and
// saying so is friendlier than a panel that looks like it must already have a password.

import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";

/** Mirrors the project's `password_min_length`. The server is the authority; this is the hint. */
const PASSWORD_MIN = 6;

type Notice = { kind: "ok" | "err"; text: string };

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (err instanceof Error && err.message) return err.message;
  return "That did not work. Try again in a moment.";
}

export default function PasswordSettings() {
  // Aliased: this component also has a local `setPassword` for the draft field.
  const { configured, ready, userId, setPassword: setAccountPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Signed-out players get nothing here: /settings already shows one sign-in panel, and a second
  // one under it would be asking the same question twice.
  if (!configured || !ready || !userId) return null;

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= PASSWORD_MIN && confirm === password && !busy;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setNotice(null);
    try {
      await setAccountPassword(password);
      setPassword("");
      setConfirm("");
      setNotice({ kind: "ok", text: "Password saved. Use it next time you sign in with your email." });
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-line bg-card/50 p-4 sm:p-5" data-testid="password-settings">
      <h2 className="font-pixel text-sm text-ink">Password</h2>
      <p className="mt-1 text-[11px] text-ink-faint">
        Set or change the password for your email sign-in. At least {PASSWORD_MIN} characters. This
        does not affect a Google sign-in.
      </p>

      <form onSubmit={save} className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-ink-faint" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="new-password"
            className="w-full border-2 border-line bg-page px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-ink-faint" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            data-testid="confirm-password"
            className="w-full border-2 border-line bg-page px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
          />
        </div>

        <button
          type="submit"
          disabled={!canSave}
          data-testid="save-password"
          className="border-2 border-brand bg-brand px-4 py-2 text-sm font-bold text-brand-deep transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-line-strong disabled:text-ink-faint"
        >
          {busy ? "Saving…" : "Save password"}
        </button>

        {tooShort && <p className="text-xs text-heat">Use at least {PASSWORD_MIN} characters.</p>}
        {mismatch && <p className="text-xs text-heat">Those two passwords do not match.</p>}
        {notice && (
          <p
            role="status"
            data-testid="password-status"
            className={`border-2 px-3 py-2 text-sm ${
              notice.kind === "err" ? "border-heat bg-heat-deep text-heat" : "border-brand bg-brand-deep text-ink"
            }`}
          >
            {notice.text}
          </p>
        )}
      </form>
    </section>
  );
}
