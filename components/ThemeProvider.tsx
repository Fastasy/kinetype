"use client";

// The equipped theme, applied to the WHOLE SITE.
//
// A theme used to be scoped to one element: FightClient set the colour variables inline on its own
// <section>, so buying a theme restyled the fight and nothing else. That made it a fight skin, not
// a website theme. This writes the theme's tokens onto <html> instead, so every `bg-page`,
// `text-ink`, `border-line` and `bg-brand` on every page follows it — the marketing pages, the
// leaderboard, the shop, the profile and the fight inside them.
//
// WHERE THE VALUE COMES FROM
//
// The save store, which is the single source the rest of the app reads. For a signed-in player the
// AuthProvider has already mirrored the account's equipped theme into that store, so the site
// follows the account; for a guest it is their own local choice. Nothing here talks to the network.
//
// SSR SAFETY
//
// The tokens are written in an EFFECT, after hydration, never during render. app/globals.css
// carries the default theme's values, so the server and the first client paint both show the
// shipped look; writing the stored theme any earlier would put it in the first client render and
// mismatch the server's HTML.
//
// WHAT IS HERE: the signal palette (--color-coin, --color-heat, --color-aqua, --color-secondary) IS
// written, because those colours have to follow the theme's lightness or a price becomes unreadable
// on a dark page — the site defaults score 2.2-3.8:1 against a dark theme, measured, which is a
// price you cannot read. But a theme may only choose between TWO fixed palettes (game/themes.ts),
// so their MEANING never drifts: coin stays gold, heat stays red, aqua stays teal.

import { useEffect, useSyncExternalStore } from "react";

import { saveStore } from "@/game/store";
import { themeById, themeCssVars } from "@/game/themes";

export default function ThemeProvider() {
  const save = useSyncExternalStore(
    saveStore.subscribe,
    saveStore.getSnapshot,
    saveStore.getServerSnapshot,
  );

  useEffect(() => {
    const root = document.documentElement;
    const vars = themeCssVars(themeById(save.equippedTheme));
    // No cleanup: the variables belong to the document for as long as the app is mounted, and
    // clearing them would flash the default theme every time this re-ran.
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
  }, [save.equippedTheme]);

  return null;
}
