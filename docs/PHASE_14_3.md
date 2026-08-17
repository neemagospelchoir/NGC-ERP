# PHASE_14_3.md — Phase 14.3 Deliverable
## Neema Gospel Choir (NGC) ERP — QA: Accessibility Audit

Phase 14 ("QA") continues to be decomposed into concrete, bounded sub-phases (see docs/PHASE_14_1.md's own introduction). 14.3 is the accessibility audit named in docs/PHASE_14_1.md §7's own decomposition: PRD §12's Non-Functional Requirements name "keyboard navigation, screen-reader labeling, color contrast, semantic HTML" as this project's accessibility bar, with no specific WCAG level cited. This sub-phase uses WCAG 2.1 Level A + AA as the industry-standard, automatable proxy for that bar — the same standard `docs/DESIGN_SYSTEM.md`'s own chart-palette contrast validation already aligns with (§4's `validate_palette.js`) — audits `apps/web` against it with a real automated tool (axe-core, via Playwright), and fixes every real violation found. 14.4 (capstone regression + broader security review) continues next under this same Phase 14 authorization.

## 1. Scope

In scope:

1. **An automated axe-core scan** (`apps/web/e2e/accessibility.spec.ts`, using `@axe-core/playwright`) of a representative sample of pages, chosen to maximize how much of the shared component library (`packages/ui`) and shell chrome gets exercised per page scanned rather than attempting exhaustive per-page coverage of all ~40 pages in this app (see §2.1 for the rationale behind each page chosen).
2. **A manual keyboard-navigation review** of the `(erp)` layout shell every module page shares, focused specifically on WCAG 2.1 SC 2.4.1 (Bypass Blocks) — whether a keyboard-only user can reach a page's own content without first tabbing through the entire primary nav.
3. **Fixing every real violation the scan and the manual review found** — four accessible-color-contrast bugs and one missing skip link, detailed in §2.2/§2.3 — rather than only documenting them.
4. **Wiring the new scan into this project's existing e2e suite** (not a separate tool or a separate CI job), so a future regression in any of the pages/components it covers is caught the same way every other e2e-covered behavior already is.

Explicitly not attempted this sub-phase (named here rather than silently skipped):

- **Exhaustive per-page coverage.** Every one of the ~40 pages under `apps/web/app/(erp)` was not individually scanned — the four pages chosen (§2.1) exercise essentially every shared component and the one layout shell every other page reuses, which was judged to give the highest coverage-per-page-scanned rather than diminishing-returns breadth. A regression in a page-specific layout choice not exercised by any of `packages/ui`'s components would not be caught by this suite; extending coverage further is a reasonable candidate for 14.4's capstone regression pass (see §7).
- **Manual screen-reader testing** (e.g. with VoiceOver/NVDA) — this sandbox has no screen reader available to drive interactively; axe-core's static analysis of ARIA roles/names/labels/landmarks is the automatable proxy used instead, which is what most real-world accessibility audits and CI gates rely on for the same reason.
- **`apps/mobile`** — PRD §12's accessibility NFR is stated once, covering the whole platform, but this sub-phase's tooling (axe-core via Playwright, a browser-DOM-based tool) has no equivalent for React Native's native accessibility tree. A mobile-specific accessibility pass would need different tooling entirely and is out of scope here.
- **Dark mode.** `docs/DESIGN_SYSTEM.md` itself describes dark mode as an explicit, user-*selected* state (not an automatic `prefers-color-scheme` flip) with its own validation discipline for chart colors; this scan ran only against the default light theme, matching how every other e2e spec in this suite already runs. One dark-mode-only near-miss was found incidentally while computing the light-mode fix and is named, not fixed, in §7.

## 2. Architecture

### 2.1 What was scanned, and why

Four scenarios in `apps/web/e2e/accessibility.spec.ts`, each scoped to axe-core's `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` rule tags only (not axe's separate "best-practice" tag set, which includes stylistic preferences PRD §12 doesn't actually commit this project to):

- **`/login`** (public, unauthenticated) — the one page every visitor, including a screen-reader user who has never signed in, must reach.
- **`/style-guide`** (public), scanned both closed and with its Modal open — this one page renders nearly every `packages/ui` component in one shot (buttons in every variant/state, form inputs including an error state, checkboxes/radios, a populated/loading/empty table, every status-pill tone, badges, empty/error states), so it gives far more coverage-per-scan than any single module page. Scanning it a second time with the Modal open exercises a modal's own focus-trap/labelling requirements independently of the page behind it.
- **`/dashboard`** (authenticated) — the one page every signed-in session reaches, exercising the real `(erp)` layout shell (SidebarNav, header, main landmark) that every other module page shares, which the standalone style-guide demo doesn't itself render.

A fifth test verifies WCAG 2.1 SC 2.4.1 (Bypass Blocks) directly via keyboard: tab once from a fresh authenticated page load and expect a "Skip to main content" link to be the very first focus stop, rather than the first of SidebarNav's 15+ nav links.

### 2.2 The four color-contrast bugs (all found by the automated scan)

All four were the same underlying shape: a UI element used one of this design system's "fixed, never-themed" status/muted-text tokens (`docs/DESIGN_SYSTEM.md`'s own words) directly as small (12px/`text-xs`) text color, without accounting for the fact that a token validated for one use (an icon fill, a chart series, a background tint) does not automatically clear WCAG 2.1 AA's 4.5:1 *text*-contrast bar at that size:

1. **`StatusPill`'s `good` and `critical` tones** (`packages/ui/src/components/StatusPill.tsx`) read their text color straight from `text-status-good`/`text-status-critical` — measured by axe at as low as **2.83:1** (tone `good`, against its own `/10` background tint) and **3.96:1** (tone `critical`), both well under the required 4.5:1. The fix is the same pattern this component's `warning` and `serious` tones *already* used — someone had already hand-picked a darker, accessible one-off shade (`#8a5a00`/`#9a3f1f`) for exactly this reason, but `good`/`critical` never got the same treatment, an inconsistency rather than a from-scratch design decision. Verified-safe replacements were computed programmatically (relative-luminance contrast math, not eyeballed): `#097809` for `good` (≥4.79:1 against every background it actually renders on, including its own tint) and `#c32f2f` for `critical` (≥4.60:1). The tint backgrounds themselves are unchanged — only the text color moved, matching the existing `warning`/`serious` precedent exactly.
2. **`StatTile`'s delta-sentiment color** (`packages/ui/src/components/StatTile.tsx`) had the identical bug — `text-status-good`/`text-status-critical` used directly for a KPI tile's "+4 this month"-style trend text. Fixed with the same two verified shades from (1), rather than an independently chosen third color for the same underlying meaning.
3. **`--text-muted` (light mode)**, the token behind `text-ink-muted` — used throughout the app for breadcrumbs, `StatTile` helper text, and `Input`/`Textarea` hint text, all at 12px — measured as low as **3.4:1** against `--page-plane`. Unlike (1)/(2), this is a single shared design token, not a per-component color choice, so the fix was made once at the token level: `packages/ui/src/tokens.css`'s light-mode `--text-muted` changed from `#898781` to `#6b6964` (same hue, darker), now ≥4.5:1 against every light-mode surface it composites over. Every consumer of `text-ink-muted` gets the fix automatically — no component-level changes needed beyond the token itself.

Every replacement color was chosen by computing WCAG relative-luminance contrast directly (the same formula axe-core itself uses), not by eyeballing a swatch — darkening each original hue along its own lightness axis until the ratio cleared 4.5:1 against every background it is actually composited over in the scanned pages (plain surfaces AND, for the status tones, their own `/10`/`/15` translucent tint), then re-verified by re-running the actual axe scan against the rebuilt app rather than trusting the arithmetic alone.

### 2.3 The missing skip link (found by manual keyboard review, not axe)

`axe-core`'s automated rules cannot detect "is there a way to skip the nav" (WCAG SC 2.4.1 is inherently a manual/behavioral check, not a static DOM property) — this was caught by keyboard-tabbing through `/dashboard` by hand, per §1.2's manual review. `app/(erp)/layout.tsx` (the shared shell every module page renders inside) previously had no skip link at all: a keyboard-only user had to tab through SidebarNav's entire primary nav (15+ links across every module group) before reaching that page's own content, on every single page load. Fixed by adding a `sr-only focus:not-sr-only` link (the standard skip-link pattern — invisible until it receives keyboard focus, at which point it's revealed as the very first focus stop, since it's first in DOM order) targeting a new `id="main-content"` `tabIndex={-1}` on the existing `<main>` element (a `tabIndex={-1}` is what lets a browser move focus to an element, like `<main>`, that isn't natively focusable).

## 3. UI

- `apps/web/app/(erp)/layout.tsx`: new skip link + `id="main-content"`/`tabIndex={-1}` on `<main>` (§2.3).
- `packages/ui/src/components/StatusPill.tsx`: `good`/`critical` tone text colors (§2.2.1).
- `packages/ui/src/components/StatTile.tsx`: delta-sentiment text colors (§2.2.2).
- `packages/ui/src/tokens.css`: light-mode `--text-muted`/`--text-muted-rgb` (§2.2.3).

No new pages; no behavior change for any legitimate flow — every fix is either a color value or a keyboard-only affordance additive to what already worked with a mouse.

## 4. Security review

Not applicable in the usual sense — this sub-phase touches no RLS policy, permission check, or server-side authorization logic; every change is a color value, a `tabindex`, or a new anchor link. Self-reviewed for the one thing worth checking in a UI-only change: that the skip link's `href="#main-content"` and the `id="main-content"` target are the only new interactive surface added, and that `tabIndex={-1}` on `<main>` does not add it to the normal Tab order (it only makes it a valid *programmatic* focus target, per the HTML spec) — confirmed by the keyboard test itself: a second `Tab` press after using the skip link moves focus into that page's own first interactive element, not back into `<main>` again.

## 5. Seed data changed this phase

None.

## 6. Validation performed

- **The new `apps/web/e2e/accessibility.spec.ts`**, run against a freshly rebuilt `apps/web` (a stale `.next` build initially masked the fixes on a first re-run — rebuilding via `turbo run build --filter=@ngc/web... --force` resolved it) — all 5 assertions pass: `/login`, `/style-guide` (closed and with its Modal open), and `/dashboard` all report zero WCAG 2.1 A/AA violations; the skip-link keyboard test passes.
- **Before/after confirmation that the scan actually caught real issues**: the first run (before any fix) failed 3 of the 4 page-scan tests with the exact color-contrast violations described in §2.2, and the skip-link test failed with "element(s) not found" — not a suite that trivially passes.
- **Every replacement color verified by direct contrast-ratio computation** (WCAG relative luminance, the same math axe-core itself uses) against every background it is actually composited over, before being applied — not chosen by eye.
- **The full Playwright e2e suite, including the new spec — 82/82** (the pre-existing 77 plus this sub-phase's 5 new assertions).
- **`pnpm typecheck`/`pnpm lint`/`pnpm --filter @ngc/services test`** — clean, 458/458 unit tests passing (unaffected — no service-layer code changed).
- **`pnpm build`** (full workspace) — succeeds.

## 7. Open issues / deferred, not overlooked

- **Not exhaustive per-page coverage** — as scoped in §1, this sub-phase covers the shell chrome and shared component library, not every one of ~40 individual pages. A page-specific layout mistake outside `packages/ui`'s own components would not be caught here.
- **No interactive screen-reader testing performed** (no VoiceOver/NVDA available in this sandbox) — axe-core's static ARIA/labelling analysis is the proxy used instead; a real screen-reader pass remains a reasonable candidate for a future audit or 14.4's capstone review.
- **`apps/mobile` was not audited** — out of scope for this sub-phase's browser-DOM-based tooling; a native-accessibility-tree audit would need different tools entirely.
- **A small dark-mode near-miss, found incidentally, not fixed**: `--text-muted` in dark mode (`#898781`, unchanged by this sub-phase) measures ~4.38:1 against `--surface-raised` (`#232322`) — just under the 4.5:1 AA bar, though comfortably over it (4.85–5.41:1) against `--surface`/`--page-plane`. Not fixed here because this sub-phase's scan runs only against the default light theme (§1, matching `docs/DESIGN_SYSTEM.md`'s own "dark mode is a selected state with its own validation discipline" principle) — named here rather than silently left for someone to rediscover.
- **`tokens.css`'s own header comment** ("consumed BY ROLE via Tailwind theme keys... never a raw hex") is not fully true in practice even after this sub-phase: `StatusPill`'s `warning`/`serious` tones already used one-off arbitrary-hex Tailwind classes (`text-[#8a5a00]`) before this phase, and `good`/`critical` now do too (§2.2.1), for consistency with that existing precedent rather than introducing a new token-infrastructure change in what is meant to be a bug-fix sub-phase. A future design-system tidy-up could promote these four one-off shades to real named tokens (e.g. `--status-good-text`) so the header comment is accurate again — left as a minor, non-urgent candidate for that future work, not fixed here to avoid scope creep in an accessibility sub-phase.
- Per the Development Control Rule, the remaining Phase 14 sub-phase (14.4 — a capstone regression pass + broader adversarial security review) continues next under this same Phase 14 authorization.
