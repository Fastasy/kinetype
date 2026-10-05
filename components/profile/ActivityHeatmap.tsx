"use client";

// GitHub-style activity grid: one column per week, one cell per day, the last 53 weeks.
//
// The server returns ONLY days that were played, so this fills the gaps itself — a grid has to
// be continuous or the shape of someone's activity is unreadable. Everything is bucketed in UTC
// to match `kinetype.match_activity()`, which groups on `created_at at time zone 'utc'`: doing it
// in local time here would shift a late-night match into the wrong square.
//
// SIZING: the squares are measured, not fixed. A hardcoded 11px cell needs ~742px before the
// weekday gutter, which does not fit the profile column — so the grid overflowed, the newest weeks
// were pushed off the right edge, and the default scroll position showed a year ago. Measuring the
// available width and deriving the cell size from it keeps all 53 weeks on screen; the scroll
// fallback exists only for widths where a readable square is impossible (a phone), and it opens on
// the NEWEST week rather than the oldest.

import { useEffect, useMemo, useRef, useState } from "react";

import type { ActivityDay } from "@/lib/kinetype-db";

const DAY_MS = 86_400_000;
const WEEKS = 53;
const GAP = 3;
/** Width reserved for the Mon/Wed/Fri gutter, gap included. */
const GUTTER = 26;
/** Below this the squares stop reading as squares, so prefer scrolling over shrinking. */
const MIN_CELL = 4;
const MAX_CELL = 12;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Four steps plus empty, so a heavy day is visibly different from a light one. */
function bucket(count: number): string {
  if (count <= 0) return "border-line bg-card/60";
  if (count === 1) return "border-brand/40 bg-brand/25";
  if (count <= 3) return "border-brand/50 bg-brand/45";
  if (count <= 6) return "border-brand/60 bg-brand/70";
  return "border-brand bg-brand";
}

export default function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Start at MAX_CELL: the server has no idea how wide the viewport is, and a first paint with the
  // largest squares simply scrolls until the observer measures. Starting small would flash a
  // shrunken grid on every load.
  const [cell, setCell] = useState(MAX_CELL);
  const [fits, setFits] = useState(true);

  const model = useMemo(() => {
    const byDay = new Map(days.map((d) => [d.day, d]));
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // End the grid on the Saturday of the current week, start it 53 weeks earlier on a Sunday,
    // so every column is a full week and the weekdays line up as rows.
    const end = new Date(today.getTime() + (6 - today.getUTCDay()) * DAY_MS);
    const start = new Date(end.getTime() - (WEEKS * 7 - 1) * DAY_MS);

    const columns: { day: string; count: number; xp: number; future: boolean }[][] = [];
    const labels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    let totalMatches = 0;
    let activeDays = 0;
    let bestDay = 0;

    for (let w = 0; w < WEEKS; w += 1) {
      const col: { day: string; count: number; xp: number; future: boolean }[] = [];
      const month = new Date(start.getTime() + w * 7 * DAY_MS).getUTCMonth();
      if (month !== lastMonth) {
        labels.push({ col: w, text: MONTHS[month] });
        lastMonth = month;
      }
      for (let d = 0; d < 7; d += 1) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
        const key = utcKey(date);
        const hit = byDay.get(key);
        const future = date.getTime() > today.getTime();
        const count = hit?.matches ?? 0;
        if (!future) {
          totalMatches += count;
          if (count > 0) activeDays += 1;
          if (count > bestDay) bestDay = count;
        }
        col.push({ day: key, count, xp: hit?.xp ?? 0, future });
      }
      columns.push(col);
    }

    return { columns, labels, totalMatches, activeDays, bestDay };
  }, [days]);

  // Size the squares to the space actually available.
  //
  // The observer fires once on observe, which IS the first measurement — so there is deliberately
  // no separate synchronous measure() call here. Setting state from an effect body would trip
  // React 19's set-state-in-effect rule, and measuring in a promise callback is exactly what the
  // observer's initial callback already gives us.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (!width) return;
      const ideal = Math.floor((width - GUTTER - (WEEKS - 1) * GAP) / WEEKS);
      setCell(Math.max(MIN_CELL, Math.min(MAX_CELL, ideal)));
      setFits(ideal >= MIN_CELL);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When it genuinely cannot all fit, open on the NEWEST week. Showing a year ago and making the
  // player scroll right to reach today is the bug this replaces.
  useEffect(() => {
    if (fits) return;
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [fits, cell, model.columns.length]);

  const box = { width: cell, height: cell };

  return (
    <div ref={wrapRef} data-testid="activity-heatmap" data-cell={cell} data-fits={fits ? "true" : "false"}>
      <div ref={scrollerRef} data-testid="heatmap-scroller" className="overflow-x-auto pb-1">
        <div className="inline-block min-w-max">
          {/* Month labels, one per column-width so they stay aligned with the grid below. */}
          <div className="mb-1 flex text-[10px] text-ink-faint" style={{ gap: GAP, paddingLeft: GUTTER }}>
            {model.columns.map((_, ci) => {
              const label = model.labels.find((l) => l.col === ci);
              return (
                <span key={ci} className="shrink-0 whitespace-nowrap" style={{ width: cell }}>
                  {label?.text ?? ""}
                </span>
              );
            })}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {/* Weekday gutter. Only alternate rows are labelled, as GitHub does. */}
            <div
              className="flex flex-col text-[10px] text-ink-faint"
              style={{ gap: GAP, width: GUTTER - GAP, marginRight: GAP }}
            >
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="text-right" style={{ height: cell, lineHeight: `${cell}px` }}>
                  {d}
                </span>
              ))}
            </div>

            {model.columns.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
                {col.map((day) => (
                  <span
                    key={day.day}
                    className={`rounded-[2px] border ${
                      day.future ? "border-transparent bg-transparent" : bucket(day.count)
                    }`}
                    style={box}
                    title={
                      day.future
                        ? ""
                        : `${day.count} ${day.count === 1 ? "match" : "matches"} on ${day.day}${
                            day.xp ? ` · ${day.xp.toLocaleString("en-US")} XP` : ""
                          }`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-faint">
        <span>
          <span className="font-mono text-ink-soft">{model.totalMatches.toLocaleString("en-US")}</span>{" "}
          matches on{" "}
          <span className="font-mono text-ink-soft">{model.activeDays}</span>{" "}
          {model.activeDays === 1 ? "day" : "days"}
          {model.bestDay > 0 && (
            <>
              {" · "}best day{" "}
              <span className="font-mono text-ink-soft">{model.bestDay}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          less
          {[0, 1, 2, 5, 8].map((n) => (
            <span key={n} className={`rounded-[2px] border ${bucket(n)}`} style={box} />
          ))}
          more
        </span>
      </div>
    </div>
  );
}
