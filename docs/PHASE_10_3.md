# PHASE_10_3.md — Phase 10.3 Deliverable
## Neema Gospel Choir (NGC) ERP — Communication: Calendar

Third sub-phase of Phase 10 (Communication): **10.1 Announcements** (complete), **10.2 Notifications** (complete), **10.3 Calendar** (this document), **10.4 Agenda & Voting** (next).

## 1. Scope

In scope:
- **A unified, read-only institutional calendar** (PRD §7.23) that merges three pre-existing, independently-RLS-governed sources into one agenda: `events` (Phase 7.5 — invitations, Worship in Spirit, internal performances, community outreach), `attendance_sessions` (Phase 7.3 — rehearsals, meetings, department meetings), and `contribution_campaigns.deadline` (Phase 9.1 — active campaigns only).
- **A scoping decision on "Month/Week/Day/Agenda views"**: `@ngc/ui` has no calendar-grid component, and building one is a substantial standalone UI investment orthogonal to this phase's actual job (aggregating data that already exists). This phase ships the one view of the four that needs no new widget — a date-grouped **agenda list** for a selected month, with month-to-month navigation via `?month=YYYY-MM` and a type filter (`?types=event,attendance_session,contribution_deadline`). A real interactive Month/Week/Day grid is named as an open item (§7), not silently dropped.

Explicitly deferred to their own later sub-phase or out of scope, named here rather than silently skipped:
- **Agenda & Voting** — 10.4, not part of this document.
- **Reminder notifications (push/SMS)** — PRD §7.23 names these; Phase 10.2 built the Notifications engine's in-app channel only (SMS/WhatsApp/Email delivery is itself an open item from 10.2), and no phase has yet wired any module's events to *automatically trigger* a notification. Calendar reminders need that wiring to exist first — left as a named gap, not built here.
- **Media production entries** — PRD §7.23 lists these as a calendar source; the Media module (Phase 11) does not exist yet, so there is no table to read from. Revisit once Phase 11 ships, the same "can't aggregate what doesn't exist yet" reasoning Phase 9.3 used for Procurement's own deferred sources.
- **Department/family activities as a distinct calendar source** — PRD §7.23 names these separately from rehearsals/meetings, but this codebase has no table representing a scheduled "department activity" independent of an `attendance_sessions` row (department meetings are already one of `attendance_sessions.session_type`'s values and are included) or an `events` row — nothing further exists to aggregate today.

## 2. Architecture

### 2.1 A pure read-side composition — no new table, RLS policy, or RPC

Unlike every other Phase 10 sub-phase so far, Calendar introduces **zero new migrations**. `listCalendarItems` (`packages/services/src/calendar/list.ts`) calls three already-shipped, already-RLS-scoped service functions unchanged in their authorization behavior — `events.listEvents`, `attendance.listSessions`, `contributions.listCampaigns` — and merges their results into one sorted list. Each source's own RLS policy (`events_select_internal`, `attendance_sessions_select_scoped`, `contribution_campaigns_select_internal`) keeps applying exactly as it always has; this module adds no bypass, no elevated read path, and no `SECURITY DEFINER` function. A department leader who can only see their own department's attendance sessions on `/attendance` sees exactly that same restricted set here too — the aggregation narrows nothing further and widens nothing.

Two existing service functions gained small, additive, backward-compatible extensions to support date-range filtering, mirroring a pattern `attendance.listSessions` already had since Phase 7.3:
- `events.listEvents(client, { status?, from?, to? })` — `from`/`to` are new optional `event_date` bounds (`ListEventsOptions`, `packages/services/src/events/list.ts`). Existing callers (`apps/web/app/(erp)/events/page.tsx`) pass no options and are unaffected.
- `contributions.listCampaigns(client, { deadlineFrom?, deadlineTo? })` — new optional `deadline` bounds (`ListCampaignsOptions`, `packages/services/src/contributions/list.ts`). The existing caller (`apps/web/app/(erp)/contributions/page.tsx`) is unaffected. A campaign with a `null` deadline is automatically excluded whenever either bound is set — Postgres's `NULL >= x`/`NULL <= x` both evaluate to unknown/false, and the in-memory test fixture's `.gte()`/`.lte()` were written to match that behavior exactly, so a campaign with nothing to place on a calendar never appears as a false match.

Only **active** contribution campaigns are surfaced (a `closed`/`cancelled`/`draft` campaign's deadline no longer means anything actionable); events and attendance sessions are shown regardless of status, including `cancelled`/`postponed` — a cancelled item still being visible on your calendar is information worth having, not noise to hide.

### 2.2 No permission gate on the page itself — a deliberate, PRD-driven choice

`/calendar` has no application-layer permission check beyond being signed in, unlike `/events` (gated on a specific set of read permissions even though `events_select_internal` RLS itself allows any signed-in user). This is intentional: PRD §7.23 describes Calendar as a "unified institutional calendar," and its own Permission Matrix context is choir-wide, not manager-only — the same "everyone has a real reason to be here" reasoning already used for Uniforms/Technical Riders/Contributions/Announcements/Notifications. Because every underlying read stays independently RLS-scoped regardless of who is asking, this costs nothing in terms of actual access control — a plain member's page load produces the same rows they could already read via `/events`, `/attendance`, and `/contributions` individually, merely merged into one list instead of three.

## 3. UI

- `/calendar` — **always visible** nav item under "Communications," alongside Announcements and Notifications. Renders a date-grouped agenda for one selected month (`?month=YYYY-MM`, defaulting to the current month), Previous/Next month navigation preserving the active type filter, a type filter (checkboxes for Event / Attendance / Contribution deadline, `?types=...`), and an empty state when nothing falls in the selected window. Each item links to its own source record's existing detail page (`/events/:id`, `/attendance/:id`, `/contributions/:id`) rather than duplicating any detail rendering here.
- No create/edit/delete UI of any kind — Calendar is a read projection over data other modules already own and manage.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) traced the actual RLS policy text for all three source tables directly from their migrations (`0006_attendance_leave.sql`, `0008_invitations_events.sql`, `0014_finance.sql`), read the aggregation code and the new optional date-range parameters, and specifically checked whether merging three independently-scoped reads into one list — or the new `.gte()`/`.lte()` filters — could create any information disclosure or access-control gap that did not already exist. Findings:

- **No issues found — ship.** The three RLS policies were confirmed to match this document's own characterization exactly (§2.1). The new date-range filters are ordinary parameterized PostgREST query-string filters (`.gte()`/`.lte()`), not string-interpolated SQL, and `date-utils.ts` additionally restricts the `month` query parameter to `/^\d{4}-\d{2}$/` before it ever reaches a query — no injection surface. Filters can only narrow rows already permitted by RLS, never widen them; RLS is enforced per-row by Postgres regardless of which query filters a caller happens to apply, so calling `listSessions` with no `departmentId` (as the aggregator does) does not expose sessions outside a caller's normal scope.
- **Confirmed no dangling/misleading links**: every `CalendarItem.href` points to a detail page that reads via the same table and same RLS policy as the list function that produced it (e.g. `attendance.getSession` uses the identical `attendance_sessions_select_scoped` policy as `attendance.listSessions`), so any item surfaced in the merged agenda is guaranteed independently readable at its linked page too.
- **One cosmetic-only correction made as a result of this review**: a doc comment in `packages/services/src/calendar/types.ts` referenced a stale, never-implemented route shape (`/attendance?session=:id`) instead of the actual route (`/attendance/:id`) the code has always used — fixed; this was a comment-only inaccuracy, never a functional or security issue.
- **Mock e2e server** (`apps/web/e2e/mock-gotrue-server.mjs`) required no calendar-specific addition — its generic, table-agnostic REST query handling already covers plain `select`/`gte`/`lte` reads on `events`/`attendance_sessions`/`contribution_campaigns`, the same "no new RPC or mock addition needed" shape Phase 9.3 (Procurement) had.

## 5. Seed data changed this phase

None.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` (workspace-wide) clean.
- 359/359 `@ngc/services` unit tests (354 pre-existing + 5 new `calendar/list.test.ts` tests: merging and sorting across all three sources, excluding out-of-range items, excluding non-active/no-deadline campaigns, honoring the type filter, and department-name resolution in an attendance session's subtitle).
- 65/65 Playwright e2e tests (63 pre-existing + 2 new `calendar.spec.ts` tests: a plain member seeing the always-visible Calendar nav link and the merged agenda for a fixed month — seeded independently of whatever date the test suite actually runs on, via explicit `?month=` navigation — and an empty month's empty state plus the type filter narrowing the agenda).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings in §4; no bug required a fix before this sub-phase was considered complete (the one correction made was a stale doc comment, not a behavior change).

## 7. Open issues / deferred, not overlooked

- **No real interactive Month/Week/Day calendar-grid widget** (§1) — this phase ships an agenda/list view only; a grid component would need to be built in `@ngc/ui` first, and is left as a named future enhancement rather than something this phase pretends isn't part of PRD §7.23.
- **No reminder notifications (push/SMS)** for upcoming calendar items — needs event-triggered notification wiring that no phase has built yet (10.2 built the Notifications engine's manual-composer path only).
- **Media production entries and department/family-activity entries** are not aggregated — no source table exists for either yet (§1).

Phase 10.3 (Calendar) is complete. Per the Development Control Rule's sub-phase continuation convention (established across Phase 8/9 and continued through 10.1/10.2), work continues directly into 10.4 (Agenda & Voting) next without a fresh "proceed" instruction; Phase 11 will require its own explicit "proceed" once all of Phase 10 is complete.
