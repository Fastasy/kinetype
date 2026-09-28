// The save, as an external store.
//
// Why this exists rather than `useEffect(() => setSave(loadSave()), [])`:
//
//   1. Reading localStorage during render would make the server and client markup
//      disagree, which is a hydration mismatch. That bug already bit this site once.
//   2. React 19's `react-hooks/set-state-in-effect` rule correctly rejects the
//      effect-based workaround. Syncing external state is exactly what
//      `useSyncExternalStore` is for, and it handles the hydration case for us: it
//      renders the server snapshot first, then re-renders with the real value.
//
// getSnapshot MUST return a stable reference between changes, or React will loop.
// The cache below is what guarantees that.

import { DEFAULT_SAVE, loadSave, writeSave, type SaveData } from "./storage";

let cache: SaveData | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): SaveData {
  if (cache === null) cache = loadSave();
  return cache;
}

/** Stable reference for SSR and hydration. Never mutated. */
function getServerSnapshot(): SaveData {
  return DEFAULT_SAVE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const saveStore = {
  getSnapshot,
  getServerSnapshot,
  subscribe,

  /** Write through to storage and notify every subscriber. */
  set(next: SaveData): void {
    cache = next;
    writeSave(next);
    for (const l of listeners) l();
  },

  /** Read-modify-write against the current cached value. */
  update(fn: (current: SaveData) => SaveData): SaveData {
    const next = fn(getSnapshot());
    saveStore.set(next);
    return next;
  },

  /** Drop the cache. Only for tests. */
  reset(): void {
    cache = null;
    for (const l of listeners) l();
  },
};
