/**
 * Mobile design tokens — plain TypeScript objects, hand-replicated from
 * `packages/ui/src/tokens.css`'s literal values (ARCHITECTURE.md S9: mobile
 * shares design TOKENS with web, but owns its own themed primitives — React
 * Native cannot consume a CSS file or Tailwind's `<alpha-value>` custom-
 * property trick, so there is no way to import `tokens.css` directly here).
 *
 * Scope: only the semantic roles a V1 mobile screen set actually needs —
 * brand, status, ink/surface, radius. The data-viz ramps (series-1..8,
 * sequential-*) in tokens.css are deliberately NOT ported here: no mobile
 * screen in this phase renders a chart, and porting an unused ramp risks it
 * silently drifting out of sync with the web source of truth. Add it here
 * (re-copied from tokens.css, not invented) if/when a mobile screen needs one.
 *
 * KEEP THESE VALUES IN SYNC WITH `packages/ui/src/tokens.css` BY HAND. There
 * is no build step that generates one from the other (see docs/PHASE_12_1.md
 * S3 for why, and what a future codegen step would look like).
 */

export const lightColors = {
  brandPrimary50: "#eef3f8",
  brandPrimary100: "#d6e3ef",
  brandPrimary200: "#aec7df",
  brandPrimary300: "#7fa6cb",
  brandPrimary400: "#4c80af",
  brandPrimary500: "#2b6294",
  brandPrimary600: "#1f4c77",
  brandPrimary700: "#17395a",
  brandPrimary800: "#102840",
  brandPrimary900: "#0a1a2c",

  brandAccent100: "#f5e1b8",
  brandAccent400: "#dc9f30",
  brandAccent500: "#c9871f",
  brandAccent700: "#7f4f10",

  pagePlane: "#f9f9f7",
  surface: "#fcfcfb",
  surfaceRaised: "#ffffff",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  textMuted: "#898781",
  borderHairline: "rgba(11, 11, 11, 0.1)",
  gridline: "#e1e0d9",

  statusGood: "#0ca30c",
  statusWarning: "#fab219",
  statusSerious: "#ec835a",
  statusCritical: "#d03b3b",
} as const;

export const darkColors = {
  brandPrimary50: "#0e2338",
  brandPrimary100: "#123049",
  brandPrimary200: "#aec7df",
  brandPrimary300: "#2c567e",
  brandPrimary400: "#4c80af",
  brandPrimary500: "#3987e5",
  brandPrimary600: "#4c80af",
  brandPrimary700: "#7fa6cb",
  brandPrimary800: "#102840",
  brandPrimary900: "#eef3f8",

  brandAccent100: "#3a2c10",
  brandAccent400: "#dc9f30",
  brandAccent500: "#e4b356",
  brandAccent700: "#f5e1b8",

  pagePlane: "#0d0d0d",
  surface: "#1a1a19",
  surfaceRaised: "#232322",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  textMuted: "#898781",
  borderHairline: "rgba(255, 255, 255, 0.1)",
  gridline: "#2c2c2a",

  statusGood: "#0ca30c",
  statusWarning: "#fab219",
  statusSerious: "#ec835a",
  statusCritical: "#d03b3b",
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type ColorTokens = typeof lightColors;
