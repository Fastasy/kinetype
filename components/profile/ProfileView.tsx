"use client";

// Another player's public profile: stats, activity heatmap, and what they are wearing.
//
// Everything comes from two SECURITY DEFINER RPCs (`public_profile`, `match_activity`), because
// after migration 0002 the profile table is own-row only and anon cannot read it at all. Nothing
// here can see an email, an auth id, or the leaderboard opt-out flag.
//
// State is written only inside promise callbacks — never synchronously in the effect body — so
// React 19's set-state-in-effect rule stays satisfied.

import { useEffect, useState } from "react";
import Link from "next/link";

import ActivityHeatmap from "./ActivityHeatmap";
import SkinSprite from "@/components/game/SkinSprite";
import ThemeSwatch from "@/components/game/ThemeSwatch";
import { RARITY_LABEL, SKINS, skinById } from "@/game/skins";
import { themeById } from "@/game/themes";
import {
  getActivity,
  getPublicProfile,
  type ActivityDay,
  type PublicProfile,
} from "@/lib/kinetype-db";
import { supabaseConfigured } from "@/lib/supabase";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; profile: PublicProfile; activity: ActivityDay[] };

const KNOWN_SKINS = new Set(SKINS.map((s) => s.id));

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-2 border-line bg-card/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`mt-0.5 font-mono text-lg ${accent ? "text-coin" : "text-ink"}`}>{value}</div>
    </div>
  );
}

export default function ProfileView({ handle }: { handle: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setState({ status: "error" });
    };

    if (!supabaseConfigured) {
      // Deferred, so nothing is written synchronously inside the effect body.
      void Promise.resolve().then(fail);
      return () => {
        cancelled = true;
      };
    }

    // Every setState lives in a promise callback, never in the effect body (React 19's
    // set-state-in-effect rule). `cancelled` drops a late response if the handle changes.
    void getPublicProfile(handle)
      .then(async (profile) => {
        if (cancelled) return;
        if (!profile) {
          setState({ status: "missing" });
          return;
        }
        const activity = await getActivity(handle);
        if (!cancelled) setState({ status: "ready", profile, activity });
      })
      .catch((err) => {
        console.error("[kinetype] profile page failed:", err);
        fail();
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (state.status === "loading") {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-10 text-center text-sm text-ink-faint">
        Loading profile…
      </p>
    );
  }

  if (state.status === "missing") {
    // An unknown handle and a hidden player are deliberately indistinguishable — the server
    // returns nothing for both, so this page cannot be used to enumerate who exists.
    return (
      <div className="border-2 border-line bg-card/50 px-4 py-10 text-center">
        <p className="font-pixel text-sm text-ink">No profile here</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-faint">
          That player does not exist, or they have kept themselves off the leaderboard.
        </p>
        <Link
          href="/leaderboard"
          className="mt-5 inline-block border-2 border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Back to the leaderboard
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p className="border-2 border-line bg-card/50 px-4 py-10 text-center text-sm text-ink-faint">
        Could not load that profile. Try again in a moment.
      </p>
    );
  }

  const { profile, activity } = state;
  const equipped = KNOWN_SKINS.has(profile.equipped_skin)
    ? skinById(profile.equipped_skin)
    : skinById("spark");
  const ownedSkins = new Set(profile.owned_skins);
  const ownedThemes = new Set(profile.owned_themes);
  const theme = themeById(profile.equipped_theme);
  const name = profile.display_name ?? "Player";
  const joined = new Date(profile.joined);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- header */}
      <section className="border-2 border-line bg-card/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full border-2 border-line"
            />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-line bg-page font-pixel text-lg text-ink">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-pixel text-lg text-ink sm:text-xl">{name}</h1>
            <p className="mt-1 font-mono text-xs text-ink-faint">@{profile.handle}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="border-2 border-brand/60 bg-brand/10 px-3 py-1.5 font-mono text-sm text-brand">
              Lv {profile.level}
            </span>
            <span className="border-2 border-line bg-card px-3 py-1.5 font-mono text-sm text-coin">
              {profile.xp.toLocaleString("en-US")} XP
            </span>
          </div>
        </div>

        {!Number.isNaN(joined.getTime()) && (
          <p className="mt-3 text-[11px] text-ink-faint">
            Playing since{" "}
            {joined.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------------- stats */}
      <section aria-labelledby="profile-stats">
        <h2 id="profile-stats" className="font-pixel text-sm text-ink">
          Stats
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Matches" value={profile.matches.toLocaleString("en-US")} />
          <Stat
            label="Record"
            value={`${profile.wins}W-${profile.losses}L`}
          />
          <Stat
            label="Win rate"
            value={
              profile.matches > 0
                ? `${Math.round((profile.wins / profile.matches) * 100)}%`
                : "—"
            }
          />
          <Stat label="Best WPM" value={profile.best_wpm > 0 ? String(Math.round(profile.best_wpm)) : "—"} accent />
          <Stat
            label="Best accuracy"
            value={profile.best_accuracy > 0 ? `${profile.best_accuracy.toFixed(1)}%` : "—"}
          />
          <Stat label="Best win streak" value={String(profile.best_streak)} />
          <Stat label="Day streak" value={String(profile.streak_days)} />
          <Stat label="Bosses beaten" value={`${profile.bosses_cleared}/9`} />
          <Stat label="Level" value={String(profile.level)} />
        </div>
      </section>

      {/* -------------------------------------------------------------- activity */}
      <section aria-labelledby="profile-activity">
        <h2 id="profile-activity" className="font-pixel text-sm text-ink">
          Activity
        </h2>
        <p className="mt-1 text-[11px] text-ink-faint">
          Matches played over the last year. Each square is one day.
        </p>
        <div className="mt-3 border-2 border-line bg-card/50 p-3 sm:p-4">
          <ActivityHeatmap days={activity} />
        </div>
      </section>

      {/* --------------------------------------------------------------- loadout */}
      <section aria-labelledby="profile-loadout">
        <h2 id="profile-loadout" className="font-pixel text-sm text-ink">
          Loadout
        </h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 border-2 border-line bg-card/50 p-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center border-2 border-line bg-page">
              <SkinSprite skin={equipped} scale={5} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                Active skin
              </div>
              <div className="mt-0.5 font-pixel text-sm text-ink">{equipped.name}</div>
              <div className="mt-1 font-mono text-[11px] text-brand-bright">
                {RARITY_LABEL[equipped.rarity]}
              </div>
            </div>
          </div>

          <div className="border-2 border-line bg-card/50 p-4">
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">
              Active theme
            </div>
            <div className="mt-2">
              <ThemeSwatch theme={theme} />
            </div>
            <div className="mt-1.5 font-pixel text-xs text-ink">{theme.name}</div>
          </div>
        </div>

        <h3 className="mt-5 font-mono text-xs text-ink-faint">
          Skins owned · {ownedSkins.size} of {SKINS.length}
        </h3>
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SKINS.map((skin) => {
            const owned = ownedSkins.has(skin.id);
            const active = skin.id === equipped.id;
            return (
              <li
                key={skin.id}
                className={`border-2 p-2 text-center ${
                  active ? "border-brand bg-brand/10" : "border-line bg-card/50"
                }`}
              >
                <div className={`flex justify-center ${owned ? "" : "opacity-25 grayscale"}`}>
                  <SkinSprite skin={skin} scale={3} />
                </div>
                <div
                  className={`mt-1.5 truncate text-[10px] ${owned ? "text-ink-soft" : "text-ink-faint"}`}
                  title={skin.name}
                >
                  {skin.name}
                </div>
                <div className="font-mono text-[9px] text-ink-faint">
                  {active ? "ACTIVE" : owned ? RARITY_LABEL[skin.rarity] : "LOCKED"}
                </div>
              </li>
            );
          })}
        </ul>
        {ownedThemes.size > 0 && (
          <p className="mt-3 font-mono text-[11px] text-ink-faint">
            Themes owned: {ownedThemes.size}
          </p>
        )}
      </section>

      <p className="text-center text-[11px] text-ink-faint">
        <Link href="/leaderboard" className="transition hover:text-brand">
          ← Back to the leaderboard
        </Link>
      </p>
    </div>
  );
}
