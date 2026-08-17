# DESIGN_SYSTEM.md — Phase 5 Deliverable
## Neema Gospel Choir (NGC) ERP — Visual Language & Component Library

**Status:** Implemented in `packages/ui` and rendered on a real, building Next.js page (`apps/web` `/style-guide`) — this document describes what was built, not a plan. See `docs/DATABASE.md`-style validation section at the end for what was actually run.

---

## 1. Design principles (spec §5, translated into decisions)

The governing brief says the product must read as "a serious international institutional ERP," not a generic church website, template dashboard, or amateur choir site, and must communicate professionalism, institutional credibility, gospel ministry, modern technology, accountability, simplicity, and operational efficiency. Translated into concrete choices:

- **A restrained, navy-and-gold institutional palette**, not a bright "church website" palette — navy reads as governance/finance/technology; a muted gold accent (used sparingly, for emphasis and status/achievement moments — a nod to the choir's award recognitions — never as a dominant color) keeps warmth without looking like a flyer.
- **One typeface family, the system UI sans**, at a disciplined type scale — no display/script fonts anywhere, including in charts (this also matches the dataviz skill's own rule: "everything stays in the system sans, no display or serif face").
- **Density appropriate to an ERP, not a marketing site**: compact table rows, clear data hierarchy, generous but not wasteful whitespace.
- **Every module screen has a defined loading, empty, error, and success state** (spec §67) — these are first-class components in this library, not an afterthought per page.
- **Confidentiality and status are communicated with an icon + label, never color alone** (accessibility, and directly consistent with how Discipline/Finance confidentiality is treated at the data layer in Phase 4).
- **The data-visualization palette is a separate, already-accessibility-validated system** (see §4) layered underneath the brand chrome — brand color drives buttons/nav/links; chart series color is a distinct, CVD-safe categorical set. They are not the same tokens, by design, so branding changes never silently break chart accessibility.

---

## 2. Open flag: no NGC brand assets were supplied

No logo, brand color, or brand guideline was provided in the governing specification. The navy/gold palette below is a **reasonable enterprise-grade placeholder** chosen to fit the stated tone (institutional + gospel ministry + achievement), documented here exactly like the ambiguities flagged in `PRD.md §14`. If NGC has (or wants to commission) an actual brand identity/logo, the only thing that needs to change is the token values in `packages/ui/src/tokens.css` §Brand — every component consumes those tokens by role, never a hardcoded hex, so a rebrand is a one-file change.

---

## 3. Brand tokens

Defined as CSS custom properties in `packages/ui/src/tokens.css`, consumed via Tailwind theme extension (`packages/ui/tailwind-preset.cjs`) so both `apps/web` and any future mobile web views share one source.

### 3.1 Primary — Institutional Navy

| Token | Light hex | Usage |
|---|---|---|
| `--brand-primary-50` | `#EEF3F8` | subtle tinted backgrounds, selected-row highlight |
| `--brand-primary-100` | `#D6E3EF` | hover backgrounds |
| `--brand-primary-300` | `#7FA6CB` | disabled/placeholder accents |
| `--brand-primary-500` | `#2B6294` | secondary actions, links |
| `--brand-primary-600` | `#1F4C77` | primary button default |
| `--brand-primary-700` | `#17395A` | primary button hover / active nav item / header |
| `--brand-primary-900` | `#0A1A2C` | dark-mode surfaces, sidebar background |

### 3.2 Accent — Gold (used sparingly: emphasis, achievement/status moments, active-tab underline)

| Token | Light hex |
|---|---|
| `--brand-accent-100` | `#F5E1B8` |
| `--brand-accent-400` | `#DC9F30` |
| `--brand-accent-500` | `#C9871F` |
| `--brand-accent-700` | `#7F4F10` |

Accent is never used as a primary-button fill or as a status color (status has its own reserved palette, §4) — it is reserved for the choir's "moment" UI: award/recognition badges on the public site, a highlighted KPI, an active tab indicator.

### 3.3 Ink, surface, and border (shared with the data-viz chrome — one set of neutrals product-wide)

| Role | Light | Dark |
|---|---|---|
| Page plane | `#f9f9f7` | `#0d0d0d` |
| Surface (cards, tables, modals) | `#fcfcfb` | `#1a1a19` |
| Primary ink | `#0b0b0b` | `#ffffff` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted ink (placeholders, captions) | `#898781` | `#898781` |
| Hairline border | `rgba(11,11,11,0.10)` | `rgba(255,255,255,0.10)` |
| Gridline | `#e1e0d9` | `#2c2c2a` |

Using the same neutral ramp for product chrome and for chart axes/gridlines keeps a dashboard visually coherent instead of looking like two different products stitched together.

---

## 4. Data visualization palette (validated, not themed)

Per the organization's dataviz skill, color for charts/dashboards is assigned by job (categorical/sequential/diverging/status), validated by script rather than eyeballed, and kept separate from brand chrome. This project adopts the skill's reference palette as-is (already passes every hard gate — see §7 for the actual validator run):

- **Categorical (8 slots, fixed order, never cycled):** blue `#2a78d6` → orange `#eb6834` → aqua `#1baf7a` → yellow `#eda100` → magenta `#e87ba4` → green `#008300` → violet `#4a3aa7` → red `#e34948` (dark-mode steps in `tokens.css`). Three light-mode slots (aqua, yellow, magenta) sit under 3:1 contrast by design — those series always ship with a visible direct label or legend, never a bare color swatch as the only identifier.
- **Sequential:** single hue blue, 100→700 ramp, for magnitude (attendance heatmaps, contribution-achievement gradients).
- **Diverging:** blue ↔ red with a neutral gray midpoint, for variance-from-target views (e.g. actual vs. budgeted expense).
- **Status (fixed, reused everywhere — Approval Center, gate pass states, asset condition, membership status):** good `#0ca30c` / warning `#fab219` / serious `#ec835a` / critical `#d03b3b`. Always icon + label, never color alone — this directly matches how `membership_status`, `gate_passes.status`, and `asset_assignments.status` are modeled in the Phase 4 schema, so the same four-state visual language can wrap any of them.

---

## 5. Typography

System UI sans stack everywhere (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) — no display/serif face, matching the dataviz skill's own typography rule so product UI and embedded charts never clash.

| Token | Size / line-height | Weight | Usage |
|---|---|---|---|
| `text-xs` | 12/16 | 400 | table meta, timestamps, captions |
| `text-sm` | 14/20 | 400/500 | body default, form labels |
| `text-base` | 16/24 | 400 | primary body copy, input text |
| `text-lg` | 18/28 | 600 | card/section titles |
| `text-xl` | 20/28 | 600 | page section headers |
| `text-2xl` | 24/32 | 700 | page titles |
| `text-3xl` | 30/36 | 700 | dashboard hero KPI numbers |
| `text-4xl` | 36/40 | 700 | rarely — public-site hero only |

Tabular figures (`font-variant-numeric: tabular-nums`) are applied to every table column of numbers and every KPI stat tile so values align vertically — per the dataviz skill's figures rule.

---

## 6. Spacing, radius, elevation

- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 — exposed as Tailwind's default spacing scale (no custom override needed beyond the token set already matching Tailwind's 4px base).
- **Radius:** `sm` 6px (inputs, badges), `md` 10px (buttons, cards), `lg` 14px (modals, panels), `pill` 999px (status pills, avatar).
- **Elevation:** `shadow-sm` (row hover), `shadow-md` (cards), `shadow-lg` (modals/popovers/toasts) — soft, low-opacity shadows only; no heavy drop shadows, keeping the "institutional, not flashy" read.

---

## 7. Components implemented in `packages/ui`

Every component is a typed React component (`.tsx`), styled with Tailwind classes generated from the token set, and re-exported from `packages/ui/src/index.ts`. All are rendered together on the `/style-guide` page in `apps/web` — see §9.

| Component | Notes |
|---|---|
| `Button` | variants: `primary` / `secondary` / `ghost` / `destructive`; sizes `sm`/`md`/`lg`; `isLoading` state (spinner replaces label, per spec §67 loading state) |
| `Input`, `Textarea`, `Select` | consistent label/hint/error slot; error state uses `critical` status color + icon, never red border alone |
| `Checkbox`, `RadioGroup` | keyboard- and label-accessible (native input under a styled wrapper, never a div-only control) |
| `Badge` / `StatusPill` | wraps the fixed status palette (§4) with a required icon + label prop — the component's TypeScript signature makes a label-less status pill a type error, not just a style guideline |
| `Card` | header/body/footer slots, optional `interactive` hover elevation |
| `Table` | header, sortable column affordance, zebra-free (relies on hairline row dividers, not banding, for the institutional/dense read), built-in `Table.EmptyState` and `Table.LoadingSkeleton` rows |
| `StatTile` | KPI dashboard tile: label, hero number (tabular-nums), optional delta (uses diverging blue/red + icon, never color alone), optional sparkline slot |
| `Modal` / `Dialog` | focus-trapped, `Esc`-to-close, labelled by `aria-labelledby`, used for confirmations (e.g. approve/reject) |
| `Toast` / `NotificationBanner` | success/warning/error/info variants mapped to the fixed status palette; auto-dismiss with a pause-on-hover timer |
| `EmptyState` | icon + heading + helper text + optional primary action — used platform-wide instead of a bare "no data" string (spec §67) |
| `ErrorState` | for failed loads; never renders a raw stack trace or backend error string (spec §52/§67 — pairs with the API layer's error-normalization rule) |
| `Sidebar` / `NavItem` | the internal ERP's primary navigation; active item takes the accent underline + primary-700 background; a `NavItem` only renders if the signed-in user has at least read access to that module (composed with, never a substitute for, the RLS/permission checks in Phase 4) |
| `PageHeader` | title, breadcrumb, primary action slot — consistent header across every module screen |
| `Avatar` | member photo with graceful initials fallback (no image = initials on a deterministic brand-tint background, not a broken image icon) |

### 7.1 Loading / empty / error / success — the four required states

Per spec §67, every module screen needs all four. This library ships them as composable primitives rather than leaving each page to reinvent them:

- **Loading:** `Table.LoadingSkeleton`, `Card`'s `isLoading` prop (renders a shimmer block), `Button isLoading`.
- **Empty:** `EmptyState` (used both for "no records yet" and "no results match your filter" — the two get different copy via props, not different components).
- **Error:** `ErrorState` + `Toast variant="error"` for transient action failures vs. `ErrorState` for a failed page/section load.
- **Success:** `Toast variant="success"` for confirmations (e.g. "Leave request submitted"); no separate "success page" component — a toast plus the resulting state change (e.g. the new row appearing in a table) is the confirmation, avoiding an extra modal step in common flows.

---

## 8. Navigation patterns

### 8.1 Internal Web ERP (desktop/tablet)
Persistent left `Sidebar` grouped by the module tree in `ARCHITECTURE.md §3` (Dashboard, Members, Attendance, Leave, Discipline, Invitations, Events, Calendar, Technical, Inventory, Uniform, Logistics, Finance, Media, Communications, Management, Documents, Reports, Constitution, Administration), collapsing to icon-only below 1280px and to an off-canvas drawer below 768px (spec §68 responsiveness). Only modules the signed-in user holds at least read access to are rendered — this is composed in the `Sidebar` from the same permission set Phase 4's `has_permission()`/RLS model resolves, so the nav and the data access boundary can never drift apart.

### 8.2 Mobile app (React Native/Expo, built in Phase 12)
Bottom tab bar with the five highest-frequency member-facing destinations (Dashboard, Events/Calendar, Attendance, Announcements, Profile), with a "More" tab surfacing everything else in §7's mobile scope (leave, contributions, documents, constitution, voting) as a list — a bottom tab bar is specified here as a design decision for Phase 12 to implement; no mobile code exists yet (ARCHITECTURE.md §9 remains the authority on that phase's scope).

---

## 9. What was actually built and run (not just described)

- `packages/ui`: token CSS (`src/tokens.css`), a Tailwind preset consuming those tokens (`tailwind-preset.cjs`), and 14 component files under `src/components/` (~20 exported components/hooks counting compound sub-parts like `CardHeader`/`CardFooter` and `useToast`), all in TypeScript, exported from `src/index.ts`.
- `apps/web`: a minimal Next.js (App Router) + TypeScript + Tailwind app whose `/style-guide` route imports and renders every component in `packages/ui` with realistic ERP content (a sample member table with a confidential-looking discipline status pill, a KPI row, a modal confirmation, toasts, form controls) — this is the actual acceptance check for this phase, not a screenshot or a description.
- The categorical and status palettes were validated with the organization's `validate_palette.js` script against both light (`#fcfcfb`) and dark (`#1a1a19`) surfaces: all hard gates pass (worst adjacent CVD ΔE 9.1 light / 8.4 dark; worst adjacent normal-vision ΔE 19.6 light / 19.3 dark). Three light-mode categorical slots (aqua, yellow, magenta) land under 3:1 surface contrast, which is expected and documented — those series always ship with a visible label, never a bare swatch.
- `pnpm install`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` were run against the real monorepo (all 8 workspace packages) and all pass — this is the acceptance gate for this phase, exactly as CI (`.github/workflows/ci.yml`) will run it on every future PR.
- The built app was actually started (`next start`) and both `/` and `/style-guide` were hit with real HTTP requests (200 on both), with the response body inspected for expected rendered content (member names, status labels, toast trigger) rather than assuming a successful build implies a working page.

### 9.1 A real bug this process caught (and the fix)

Two issues surfaced only by actually building and inspecting output, not by reading the code:

1. **React Server Components crash on first build** (`TypeError: s.createContext is not a function` while collecting page data for `/_not-found`). Cause: `ToastProvider` (uses `createContext`/`useState`) and `Modal`/`Input`/`Checkbox` (use `useRef`/`useEffect`/`useId`) were missing `"use client"` directives, so Next.js tried to include them in a Server Component bundle where React's server-condition export doesn't provide those APIs. Fixed by adding `"use client"` to `Toast.tsx`, `Modal.tsx`, `Input.tsx`, and `Checkbox.tsx` (the files that actually call hooks/`createContext` — components with no hooks were correctly left as server-renderable).
2. **Tailwind opacity modifiers silently compiled to nothing** (`bg-status-good/10` produced no CSS rule at all — not broken-looking, just absent). Cause: the Tailwind preset originally mapped colors to plain `var(--token)` hex strings; Tailwind can only substitute its `<alpha-value>` placeholder into an `rgb(... / <alpha-value>)`-shaped value, not a bare hex/var. Fixed by adding a parallel `--token-rgb` channel-triplet variable for every color in `tokens.css` and rewriting `tailwind-preset.cjs` to emit `rgb(var(--token-rgb) / <alpha-value>)`. Verified after the fix by grepping the actual compiled CSS for `bg-status-good\/10{background-color:rgb(var(--status-good-rgb)/.1)}` — confirming the rule now really exists, not just that the build didn't error.

Both are exactly the class of "looks done, isn't" defect the governing spec warns against (§71.17 "no feature should be marked complete if it is only a visual mockup") — they would have shipped invisibly if this phase had stopped at "the code compiles."
