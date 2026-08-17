import * as React from "react";
import { cn } from "../utils/cn";

export interface StatTileProps {
  label: string;
  value: string | number;
  delta?: {
    value: string;
    direction: "up" | "down";
    /** Whether "up" is a good or bad thing for THIS metric (e.g. up
     * attendance = good, up outstanding-expenses = bad) — the tile never
     * assumes up==good. */
    sentiment: "good" | "bad";
  };
  helperText?: string;
  isLoading?: boolean;
}

/**
 * Dashboard KPI tile (spec S47-S48). Hero number uses tabular figures so a
 * row of tiles aligns; delta is communicated with an arrow glyph + color +
 * text, never color alone, per the dataviz skill's status-color rule.
 */
export function StatTile({ label, value, delta, helperText, isLoading }: StatTileProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-md border border-hairline bg-surface p-4 shadow-sm" aria-hidden="true">
        <div className="mb-2 h-3 w-1/2 rounded-sm bg-ink-muted/20" />
        <div className="h-7 w-2/3 rounded-sm bg-ink-muted/20" />
      </div>
    );
  }

  // Phase 14.3 accessibility audit: same fix as StatusPill.tsx's own
  // TONE_CLASSES comment — the raw `text-status-good`/`text-status-critical`
  // tokens fail WCAG 2.1 AA's 4.5:1 text contrast at this 12px/xs size
  // (axe-core caught 3.26:1 on a plain surface). Using the same darkened,
  // contrast-verified one-off shades here too, rather than a second
  // independent color choice for the same underlying meaning.
  const deltaColor =
    delta && ((delta.direction === "up") === (delta.sentiment === "good"))
      ? "text-[#097809]"
      : "text-[#c32f2f]";

  return (
    <div className="rounded-md border border-hairline bg-surface p-4 shadow-sm">
      <p className="text-sm text-ink-secondary">{label}</p>
      <p className="tabular-nums mt-1 text-3xl font-bold text-ink-primary">{value}</p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", deltaColor)}>
          <span aria-hidden="true">{delta.direction === "up" ? "↑" : "↓"}</span>
          {delta.value}
        </p>
      )}
      {helperText && <p className="mt-1 text-xs text-ink-muted">{helperText}</p>}
    </div>
  );
}
