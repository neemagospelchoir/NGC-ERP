/**
 * Shared Tailwind preset for the NGC ERP design system. Maps the CSS custom
 * properties in src/tokens.css to Tailwind theme keys so components (and
 * any future app) can write `bg-brand-700`, `text-status-critical`, etc.
 * instead of raw hex — see docs/DESIGN_SYSTEM.md.
 *
 * Every color is wired through `rgb(var(--token-rgb) / <alpha-value>)`
 * rather than a bare `var(--token)` string. That's required for Tailwind's
 * opacity modifier (`bg-status-good/10`) to work at all — a real bug caught
 * during Phase 5 by actually building the app and inspecting the compiled
 * CSS: with a plain hex/var color, `/10` compiled to nothing, silently. See
 * tokens.css's header comment for the full explanation.
 */
function withOpacity(cssVarRgb) {
  return `rgb(var(${cssVarRgb}) / <alpha-value>)`;
}

module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: withOpacity("--brand-primary-50-rgb"),
          100: withOpacity("--brand-primary-100-rgb"),
          200: withOpacity("--brand-primary-200-rgb"),
          300: withOpacity("--brand-primary-300-rgb"),
          400: withOpacity("--brand-primary-400-rgb"),
          500: withOpacity("--brand-primary-500-rgb"),
          600: withOpacity("--brand-primary-600-rgb"),
          700: withOpacity("--brand-primary-700-rgb"),
          800: withOpacity("--brand-primary-800-rgb"),
          900: withOpacity("--brand-primary-900-rgb"),
        },
        accent: {
          100: withOpacity("--brand-accent-100-rgb"),
          400: withOpacity("--brand-accent-400-rgb"),
          500: withOpacity("--brand-accent-500-rgb"),
          700: withOpacity("--brand-accent-700-rgb"),
        },
        surface: {
          DEFAULT: withOpacity("--surface-rgb"),
          raised: withOpacity("--surface-raised-rgb"),
          plane: withOpacity("--page-plane-rgb"),
        },
        ink: {
          primary: withOpacity("--text-primary-rgb"),
          secondary: withOpacity("--text-secondary-rgb"),
          muted: withOpacity("--text-muted-rgb"),
        },
        status: {
          good: withOpacity("--status-good-rgb"),
          warning: withOpacity("--status-warning-rgb"),
          serious: withOpacity("--status-serious-rgb"),
          critical: withOpacity("--status-critical-rgb"),
        },
        series: {
          1: withOpacity("--series-1-blue-rgb"),
          2: withOpacity("--series-2-orange-rgb"),
          3: withOpacity("--series-3-aqua-rgb"),
          4: withOpacity("--series-4-yellow-rgb"),
          5: withOpacity("--series-5-magenta-rgb"),
          6: withOpacity("--series-6-green-rgb"),
          7: withOpacity("--series-7-violet-rgb"),
          8: withOpacity("--series-8-red-rgb"),
        },
        hairline: "var(--border-hairline)",
        gridline: withOpacity("--gridline-rgb"),
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
};
