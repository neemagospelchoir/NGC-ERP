import * as React from "react";
import { cn } from "../utils/cn";

export type StatusTone = "good" | "warning" | "serious" | "critical" | "neutral";

// Phase 14.3 accessibility audit: `good` and `critical` used to read their
// text color straight off the `text-status-good`/`text-status-critical`
// tokens — the same raw hue used for icons/charts/background tints, which
// an automated axe-core scan (apps/web/e2e/accessibility.spec.ts) caught
// failing WCAG 2.1 AA's 4.5:1 text-contrast requirement (as low as 2.83:1
// against this pill's own `/10` background tint). `warning` and `serious`
// already avoided this — someone had already hand-picked a darker,
// accessible one-off shade (`#8a5a00`/`#9a3f1f`) for exactly this reason —
// `good`/`critical` just never got the same treatment. Fixed by giving all
// four tones the same pattern: the tint background keeps the "true" fixed
// status hue, only the text color is a separately darkened, contrast-safe
// shade of the same hue (verified ≥4.5:1 against this pill's own tint AND
// every plain surface it's ever composited over — see that spec's own doc
// comment for the exact ratios).
const TONE_CLASSES: Record<StatusTone, string> = {
  good: "bg-status-good/10 text-[#097809]",
  warning: "bg-status-warning/15 text-[#8a5a00]",
  serious: "bg-status-serious/15 text-[#9a3f1f]",
  critical: "bg-status-critical/10 text-[#c32f2f]",
  neutral: "bg-ink-muted/10 text-ink-secondary",
};

const TONE_ICON: Record<StatusTone, string> = {
  good: "●",
  warning: "▲",
  serious: "▲",
  critical: "✕",
  neutral: "○",
};

export interface StatusPillProps {
  tone: StatusTone;
  /** Required — a status pill may never carry meaning by color alone. */
  label: string;
  className?: string;
}

/**
 * The ONLY way to render a status color in this design system. `label` is a
 * required prop (not optional) specifically so a color-only status pill is a
 * TypeScript error, not just a lint warning — enforcing spec S52/§67's
 * "never color alone" rule at the type level.
 */
export function StatusPill({ tone, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span aria-hidden="true" className="text-[10px]">
        {TONE_ICON[tone]}
      </span>
      {label}
    </span>
  );
}

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "brand" | "accent" | "neutral";
  className?: string;
}

/** Non-status decorative badge (e.g. "New", "Beta", a category tag). */
export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variantClasses = {
    brand: "bg-brand-50 text-brand-700",
    accent: "bg-accent-100 text-accent-700",
    neutral: "bg-ink-muted/10 text-ink-secondary",
  }[variant];
  return (
    <span className={cn("inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium", variantClasses, className)}>
      {children}
    </span>
  );
}
