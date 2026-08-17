# PHASE_14_4.md — Phase 14.4 Deliverable

## Neema Gospel Choir (NGC) ERP — QA: Capstone Regression + Broader Security Review

Phase 14 ("QA") has no PRD-defined scope of its own (see docs/PHASE_14_1.md's own introduction) and was decomposed into 14.1 (correctness/security hardening), 14.2 (CI/test-pipeline hardening), and 14.3 (accessibility audit). 14.4 — the capstone regression pass + broader adversarial security review those three sub-phases each named as the natural next step — was proposed after 14.3 but not started at the time: the user's own explicit "Proceed with phase 15" instruction moved directly to the Deployment phase instead, a PHASE-boundary instruction that this session's Development Control Rule treats as taking precedence over a self-proposed sub-phase decomposition. Phase 15 shipped and was committed; the user then explicitly asked to return to 14.4 rather than treat Phase 15 as the end of the roadmap. This document is that return.

## 1. Scope

In scope, matching exactly what 14.1/14.2/14.3 each named as 14.4's own remit:

1. **A capstone regression run** confirming the full validation suite — typecheck, lint, unit tests, a fresh production build, and the complete Playwright e2e suite — still passes as one cohesive whole across all fifteen phases' combined changes, not just phase-by-phase in isolation.
2. **A broader adversarial security review**, commissioned specifically to sweep every module Phase 14.1's own targeted fixes did NOT already cover — Directory, Onboarding, Attendance & Leave (beyond 14.1's own `attendance` fix), Vendors & Inventory, Uniforms, Logistics, Contributions, Expenses (beyond 14.1's workflow guard), Procurement (beyond 14.1's state machine), Calendar, Media, Reports, and the users/roles/permissions tables themselves — looking for the same bug *patterns* this project has already found real instances of elsewhere (workflow bypass via direct write, a missing `WITH CHECK` letting an owner column be forged, a NULL-comparison that fails open, a `SECURITY DEFINER` function still holding default-PUBLIC `EXECUTE`, privilege escalation, an overly-broad `SELECT` policy).
3. **Fixing every real, confirmed gap** the review found, each independently re-verified against a live Postgres instance before being called done — not merely documented as an open item.
4. **Extending `supabase/tests/smoke.sql`'s own automated coverage** to real RLS gaps that earlier phases' own security reviews already found and fixed on their own (Discipline, Announcements, Notifications, Agenda & Voting, Media), which — unlike Phase 14.1's six fixes — never received the Phase 14.2 smoke-test treatment. `docs/PHASE_14_2.md` §7 named this explicitly as "exhaustive RLS coverage remains manual" and a reasonable candidate for this sub-phase.

Explicitly not attempted this sub-phase (named here rather than silently skipped):

- **Re-deriving or re-litigating every prior phase's own already-completed security review.** Fourteen phases' worth of individual reviews already happened, each documented in its own `docs/PHASE_*.md` §4/§7. This sub-phase's review deliberately targeted the *gaps between* those reviews — modules and bug shapes no single phase's own narrow review would have been looking for — not a repeat of work already done and already validated.
- **Extending `smoke.sql` to genuinely exhaustive coverage of all ~40 tables' RLS policies.** The five modules added this sub-phase (§2.3) were chosen because they are real, previously-shipped fixes with zero automated DB-layer coverage — the same selection principle 14.2 itself used. Tables whose RLS is a simple, uniform `has_permission(...)` check with no forgeable column and no history of a real bug (Uniforms, Logistics, most of Vendors/Inventory) were reviewed (§2.2) but not given dedicated smoke scenarios, to keep this sub-phase's own diff reviewable rather than adding assertions for their own sake.
- **A fresh manual `psql` walkthrough of every RLS policy in the schema.** The adversarial review (§2.2) read every migration's final RLS state directly rather than re-deriving each policy by hand against a running database — the three confirmed findings were then independently re-verified against real Postgres (§6) before being trusted.

## 2. Architecture

### 2.1 Capstone regression

Before commissioning the security review, the full validation suite was re-run exactly as it stands after Phase 15: `pnpm typecheck`/`pnpm lint` (all 8 workspace packages), `pnpm --filter @ngc/services test` (458/458), a fresh `apps/web` production build, and the complete Playwright e2e suite (84/84, unchanged from Phase 15's own count — this sub-phase adds no new e2e specs, only new `smoke.sql` scenarios, since every gap this phase found and fixed is a database-layer RLS/trigger behavior with no application-layer surface to add an e2e assertion for). All green, confirming Phase 15's own deployment infrastructure introduced no regression into the application itself. The same full suite was re-run again after this sub-phase's own migration (§2.4) landed — see §6.

### 2.2 The adversarial security review

A subagent was given the full list of modules Phase 14.1's own six fixes did not target, the exact bug *patterns* this codebase has already found real instances of (listed in §1 item 2 above), and instructions to read every one of the 39 pre-existing migrations directly (RLS/trigger final state, since later migrations frequently replace earlier ones) rather than re-deriving policy by hand. It reported three findings, in decreasing severity, each independently re-verified against real Postgres by direct inspection of the referenced migration's exact SQL before being trusted:

1. **Definite — the 0036 workflow-governed-status guard only ever examined transitions FROM the one specific status each table's own service-layer code happens to sync from** (`pending_management_approval` for invitations, `pending_approval` for expense_requests). Both tables have real pre-approval statuses besides that one guarded value (invitations: `draft`, `submitted`, `received`, `under_review`, `pending_information`; expense_requests: `draft`, `submitted`) — confirmed directly against `0008_invitations_events.sql`'s and `0014_finance.sql`'s own `check (status in (...))` constraints. Since the flat RLS `UPDATE` policies on both tables (`invitations_write_scoped`, `expense_requests_update_scoped`) restrict only by permission, not by current status, a holder of `events.invitations.manage` or `finance.expenses.manage`/`.approve` could issue a direct REST `PATCH` jumping straight from any of those earlier statuses to `approved` (or invitations' `declined`), skipping the entire approval chain and `record_workflow_decision` together, with no `workflow_instances` row ever created — the exact bypass class 0036 itself was written to close, just from a starting point 0036's own guard never examined. `gate_passes` is unaffected in practice: its own initial status is already `pending_approval`, so there is no earlier status to jump from.
2. **Definite — `event_attendance.recorded_by` (0008) has no `WITH CHECK` at all**, the identical bug shape 0038 already found and fixed on the sibling `attendance` table (rehearsal/session attendance) — 0038's own scope note ("attendance itself... not attendance_sessions/leave_requests") evidently did not consider `event_attendance` (on-the-day event attendance, a distinct table per its own 0008 comment) as a sibling needing the same fix. Any `attendance.records.manage` holder could forge `recorded_by` as an arbitrary user for event-day attendance, with no database-level tie to `auth.uid()`.
3. **Lower severity, an integrity gap rather than an authorization one — `procurement_requests_write_finance` (0014) lets any `finance.procurement.manage` holder `INSERT` a procurement request against ANY expense request regardless of its status.** The "must be an already-approved expense request" rule (`packages/services/src/procurement/create.ts`) is enforced only in the application layer; a direct REST insert could create a procurement record against a `draft`/`rejected` expense request, bypassing that precondition. Requires an already-privileged Finance role (an insider-risk shape, similar in kind to other accepted residual risks already named elsewhere in this codebase, e.g. 0027's discipline-lookup audit trail).

Every other module reviewed (Directory, Onboarding, Attendance & Leave's `attendance_sessions`/`leave_requests`, Vendors/Inventory, Uniforms, Logistics, Contributions, Procurement's state machine itself, Calendar, Media's own 0035 fix, Reports, and the users/roles/permissions tables) was found consistent with this project's own established patterns, with no exploitable defect — see the review's own full findings, folded into this document's git history rather than repeated verbatim here. Two minor, non-exploitable observations (a `comments` owner-repoint gap, a `gate_passes` self-editable timestamp) were noted for completeness but judged not worth a fix given their negligible impact.

### 2.3 New `supabase/tests/smoke.sql` scenarios (Scenarios I–P)

Five scenarios extend automated coverage to real RLS fixes from earlier phases that never received it:

- **Scenario I** (0026, Discipline): a `discipline.cases.read` holder can see a member WITH a case on file, cannot see one with no case (not a blanket grant), and `find_member_by_number_for_discipline()` refuses a caller without `discipline.cases.manage` even for an exact match (the "not a backdoor directory" guarantee).
- **Scenario J** (0032, Announcements): the author of a future-scheduled announcement can read it before it goes live; a plain member cannot.
- **Scenario K** (0033, `send_notification`): a `pro_spokesperson` (non-`super_admin`) sender's department-audience notification actually fans out to more than just themself — the exact scenario that was structurally broken before 0033's fix.
- **Scenario L** (0034, Agenda & Voting): an eligible voter (listed in `eligible_user_ids`) can vote; an ineligible one is blocked at the database layer, not just hidden by UI; a `management.agenda.manage` holder (not Super Admin) cannot read a raw ballot on an `is_anonymous` agenda.
- **Scenario M** (0035, Media): mirrors Scenario F's playlist pattern — a role-shared and a member-shared unpublished media link are each visible to their intended audience and invisible to an outsider.

Three further scenarios cover this sub-phase's own fixes (§2.4):

- **Scenario N**: the closed "skip straight to approved from an early status" bypass, for both invitations and expense_requests.
- **Scenario O**: `event_attendance.recorded_by`'s new `WITH CHECK`, mirroring Scenario H's `attendance` pattern.
- **Scenario P**: `procurement_requests`' new insert-time approved-expense-request linkage guard, with both a blocked (draft expense request) and a positive (approved expense request) case.

Two new fixture users (`SMOKE Discipline Manager`, `SMOKE PRO Spokesperson`) were added, holding permissions no existing fixture user held. Total smoke assertions: **38** (20 from Phase 14.2's own Scenarios A–H, 18 new this sub-phase).

### 2.4 New migration: `0040_phase_14_4_security_hardening.sql`

Three fixes, each scoped as narrowly as the confirmed gap itself:

1. **`guard_workflow_governed_status_change()` redesigned**: the function now checks, independent of `old.status`, whether `new.status` is one of the table's workflow-decision-outcome values (`approved`, invitations' `declined`) — if so, `workflow_instances` must already reflect the matching outcome for that exact record, regardless of what the row's prior status was. The pre-existing "any other unrecognized exit from the one specific guarded 'from' status is blocked unless allowlisted" behavior (validated by Scenarios A5/C1, both still passing unchanged) is left completely untouched — this is an additional check layered on top, not a replacement.
2. **`event_attendance_write_scoped` given a `WITH CHECK (recorded_by = auth.uid() and has_permission(...))`**, the identical pattern 0038 already applied to `attendance`.
3. **A new `BEFORE INSERT` trigger on `procurement_requests`** re-checking, at the database layer, the same "expense request must already be approved" precondition `create.ts` already enforces in the application layer. Deliberately scoped to `INSERT` only, not folded into an RLS `WITH CHECK` that would also re-run on every `UPDATE`: `expense_requests.status` can legitimately move to `paid`/`closed` via Finance's own separate lifecycle (`markExpensePaid`/`closeExpenseRequest`) *while* a `procurement_requests` row for it is still genuinely progressing through `vendor_selected`/`purchased` — a `WITH CHECK` re-evaluated on every write would have incorrectly blocked those already-legitimate later-stage procurement writes the moment Finance closed the underlying expense request out of band. A trigger scoped to `TG_OP = INSERT` avoids that false positive entirely.

## 3. UI

None. Every change this sub-phase makes is a database migration or a test file; no application code changed.

## 4. Security review

This sub-phase's own security review IS its deliverable (§2.2) — its three confirmed findings are documented above and fixed in §2.4, each independently re-verified against real Postgres before being trusted (§6). A second-order check was also applied to the fix itself: the redesigned `guard_workflow_governed_status_change()` was checked against every existing smoke-test scenario that exercises it (A1–A5, B1–B3, C1–C2) to confirm the new, broader check is additive and does not alter any previously-validated behavior — confirmed by all of those scenarios still passing unchanged (§6) rather than assumed from the diff alone. The procurement insert-guard's scoping to `INSERT`-only (rather than `for all`) was a deliberate, reasoned choice to avoid introducing a new false-positive risk into an already-working later-stage flow (§2.4 item 3) — a case where the narrower fix is the more correct one, not merely the smaller one.

## 5. Seed data changed this phase

None.

## 6. Validation performed

- **The adversarial security review's three findings were each independently re-verified** by direct inspection of the exact current-state migration SQL (`0008`, `0014`, `0036`) before any fix was written, confirming each was real and not a misreading of an already-correct policy.
- **`0040_phase_14_4_security_hardening.sql` applied cleanly** against a fresh scratch Postgres 16 database, all 40 migrations in order, with no errors.
- **The full `supabase/tests/smoke.sql` suite — 38/38 assertions passing** against that same fresh database, including: all 20 pre-existing Phase 14.2 assertions unchanged (confirming the redesigned workflow guard is additive, not a regression), and all 18 new assertions (Scenarios I–P) — the five extended-coverage scenarios (I–M) passing against the ALREADY-correct existing code (confirming those earlier fixes hold up under new automated scrutiny), and the three new-fix scenarios (N–P) confirming each of this sub-phase's own three fixes actually blocks the exploit it targets while preserving the legitimate path (each has both a blocked-case and a positive-case assertion, per this project's own established convention).
- **`pnpm typecheck`/`pnpm lint`** — clean across all 8 workspace packages (no TypeScript/application code changed this sub-phase, so these are unaffected-but-reconfirmed).
- **`pnpm --filter @ngc/services test`** — 458/458, unaffected.
- **A fresh `apps/web` production build** — succeeds.
- **The full Playwright e2e suite — 84/84**, unchanged from Phase 15's own count (no new e2e specs this sub-phase — every fix here is a database-layer behavior with automated coverage added at that same layer, in `smoke.sql`, not at the application layer).
- **The scratch Postgres database used for validation was dropped** after the run; no leftover state.

## 7. Open issues / deferred, not overlooked

- **Two minor, non-exploitable observations from the security review were not fixed**: `comments_update_own` has no `WITH CHECK` re-validating `owner_type`/`owner_id` on `UPDATE` (an author could technically re-point their own comment at a different owner record, but gains no read access beyond what that new owner type's own `SELECT` policy already grants); and `gate_passes_write_scoped`'s implicit `WITH CHECK` lets the self-responsible party edit `event_id`/timestamps on their own gate pass after creation (no privilege gain). Both are named here rather than silently dropped, as candidates for a future pass if ever prioritized.
- **`smoke.sql` still does not cover every RLS policy in the schema** — by design (§1) — the five modules added this sub-phase were chosen because they are real, previously-shipped, zero-coverage fixes, the same selection bar 14.2 itself used, not because the schema's remaining ~30 tables are assumed risk-free (§2.2 reviewed them directly and found them consistent with established patterns, but "reviewed once" is not the same guarantee as "has a regression test").
- **This was Phase 14's own last remaining sub-phase.** With 14.1, 14.2, 14.3, and now 14.4 all complete and validated, all of Phase 14 (QA) is complete. Phase 15 (Deployment) was already completed and committed before this sub-phase, out of the roadmap's own numeric order, per the user's own explicit instruction at the time (see this document's introduction) — nothing in `ARCHITECTURE.md` §19's roadmap remains unaddressed. Any further work is a new, user-directed scope, not a continuation of a named phase.
