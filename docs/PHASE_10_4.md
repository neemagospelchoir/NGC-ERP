# PHASE_10_4.md — Phase 10.4 Deliverable
## Neema Gospel Choir (NGC) ERP — Communication: Agenda & Voting

Fourth and final sub-phase of Phase 10 (Communication): **10.1 Announcements**, **10.2 Notifications**, **10.3 Calendar** (all complete), **10.4 Agenda & Voting** (this document). Completing this document completes Phase 10 as a whole.

## 1. Scope

In scope:
- **Agenda items and voting** (PRD S45/S14.9), built on the schema `0017_governance.sql` already shipped in Phase 4: `agendas` (title, description, voting method, eligible-voter scope, anonymity flag, deadline, status), `votes` (one per eligible member per agenda, `choice` of yes/no/abstain), and the aggregate `agenda_results` view.
- **Two genuine RLS gaps found while building this phase's own service layer, fixed via migration 0034** — see §2.1/§2.2. Unlike 10.1's and 10.2's bugs (an accidental total lockout, and an accidental structural break respectively), these were gaps the original schema's own comments already *named* but left unenforced — this phase closes them at the database layer instead of leaving them as documented-but-unenforced promises.

Explicitly deferred to later phases or out of scope, named here rather than silently skipped:
- **A real interactive ballot UI beyond radio-button yes/no/abstain** — no further sophistication (ranked choice, multi-question agendas) exists in PRD S45 to build toward.
- **Voter name resolution in the "individual ballots" list** — a raw `voterId` UUID is shown, the same plain-ID simplification used throughout this codebase (Announcements' target IDs, Notifications' specific-user IDs) rather than a name-search picker.
- **Constitution/Guidelines documents** — 0017's own header comment states these are served through the generic Documents module (category = 'Constitution'/'Policy') rather than a separate table; that module still has no service layer or UI built by any phase (the same pre-existing gap named in 10.1 §1/9.2 §1), so there is nothing to build here either.

## 2. Architecture

### 2.1 Gap found and fixed: vote eligibility was never actually checked at write time

The original `votes_insert_self` RLS (0017) read only `for insert with check (voter_id = auth.uid())`. It never looked at the agenda's own `eligible_voter_scope`/`eligible_department_id`/`eligible_family_id`/`eligible_user_ids`, nor its `status`/`voting_deadline`. This is not an information-disclosure gap like most of this codebase's other caught bugs — it is a **vote-integrity** gap: any signed-in user could cast a binding vote on an agenda item explicitly scoped to one department, one family, leadership, or a specific-user list, and that vote would count toward `agenda_results` exactly the same as an eligible one's. Nothing except client-side "who should see this ballot" UI logic stood in the way, and nothing at all stopped voting after the deadline or on a `draft`/`closed`/`cancelled` item.

**Fix (migration 0034)**: `votes_insert_self` now requires the target agenda to be `status = 'open'` and `voting_deadline > now()`, AND that the caller actually matches the agenda's own `eligible_voter_scope` — `all_members` unconditionally, `department`/`family` via a live `members` row matching `eligible_department_id`/`eligible_family_id`, `specific_users` via `auth.uid() = any(eligible_user_ids)`, and `leadership` via `has_permission('management.agenda.manage')` (the same permission that already identifies this schema's leadership roles — secretary, chairman, vice chairman, super admin per the seed — everywhere else RLS needs to ask that question, since no separate "leadership" role/flag exists anywhere in this schema).

**Manually verified against a live local Postgres instance** with real `authenticated`-role sessions: a Dept B member's vote on a Dept-A-scoped agenda was rejected; a Dept A member's vote on that same agenda succeeded; voting on a `closed` agenda was rejected. An independent security review additionally re-derived the SQL's boolean grouping by hand (including the NULL-handling case where a mis-scoped agenda has no `eligible_department_id` set) and confirmed no precedence error and no accidental widening or lockout.

### 2.2 Gap found and fixed: any `management.agenda.manage` holder — not just Super Admin — could read anonymous ballots

The original `votes_select_own_or_admin` RLS (0017) read `for select using (voter_id = auth.uid() or public.has_permission('management.agenda.manage'))`. The `agenda_results` view's own pre-existing comment already stated the intended guarantee precisely: *"Never join votes.voter_id into any view/query exposed to a non-Super-Admin role for an is_anonymous agenda"* — but named the service/API layer, not RLS, as where that must be enforced. Under this codebase's own repeatedly-stated model (`0024_local_dev_role_grants.sql`'s own comment: RLS is the actual gate, app-layer checks are convenience, not a boundary), an app-layer-only promise is not real: a `secretary`, `chairman`, or `vice_chairman` (all three hold `management.agenda.manage`, none holds `super_admin`, per the seed) querying `votes` directly — devtools, a raw PostgREST call, or a future caller that simply forgets the app-layer check — would see the exact anonymous voter-to-choice mapping "anonymous" is supposed to hide.

**Fix (migration 0034)**: a `management.agenda.manage` holder may read every row of a **non-anonymous** agenda's votes (needed for auditing/verifying individual ballots when integrity, not privacy, is the concern — PRD S14.9 draws exactly this distinction), but for an **anonymous** agenda, only the voter's own row or a true `has_role('super_admin')` caller may read raw rows. `agenda_results` itself is untouched and remains readable by anyone signed in regardless of anonymity — the aggregate tally was never what "anonymous" was meant to hide, only who voted which way.

**Manually verified against a live local Postgres instance**: a `secretary`-role user got zero rows querying `votes` on an anonymous agenda they hadn't voted on themselves; a true `super_admin` got the full row back on that same agenda; the voter themselves could always read their own row; the same secretary correctly *could* read every row on a separate non-anonymous agenda. An independent, second security review re-derived this from the actual seed data (confirming `chairman`/`vice_chairman`/`secretary` hold `management.agenda.manage` but not `super_admin`, and that `super_admin` is a wholly separate role) and confirmed the fix genuinely closes the gap for a direct, app-bypassing query, not just for this phase's own UI.

### 2.3 `castVote`'s app-layer "already voted" pre-check is a UX nicety, not the authorization boundary

`castVote` (`packages/services/src/agendas/vote.ts`) checks for an existing vote via `getMyVote` before inserting, mirroring `attendance.recordAttendance`'s established "check current, then write" shape — this gives a clean error message instead of a raw constraint-violation message for the common case. The table's own `unique (agenda_id, voter_id)` constraint (0017) remains the real backstop against a same-instant double-submit race, which is why `castVote` still explicitly handles a `23505` (unique-violation) response as well as a `42501` (RLS-rejection, ineligible/closed) response — the pre-check is a UX nicety, not a boundary substitute.

## 3. UI

- `/agendas` — **always visible**, the same "everyone has a real reason to be here" shape as Announcements/Notifications/Calendar: `agendas_select_authenticated` RLS lets any signed-in user read every agenda row (including `draft` ones — an intentional, unchanged, pre-existing design choice, the same "any signed-in user reads everything" transparency baseline used since Invitations, Phase 7.5). Creating an agenda item is shown only to `management.agenda.manage` holders.
- `/agendas/[id]` — the vote tally (`agenda_results`) is always shown regardless of anonymity. A voting form is shown to any signed-in caller who hasn't voted yet while the item is open and its deadline hasn't passed; once voted, the page shows the caller's own recorded choice instead (a vote cannot be changed). An "individual ballots" list is shown **only** when the caller holds `management.agenda.manage` **and** the agenda is not anonymous — deliberately matching `votes_select_own_or_admin` RLS exactly, so a manager is never shown a control that would silently return nothing for an anonymous agenda and read as a bug rather than the deliberate protection it is. Status-transition buttons (open → closed/cancelled) are shown to managers only, forward-only, matching Contributions'/Procurement's identical "moves forward only" shape.

## 4. Security review

Two independent adversarial reviews were run this phase: one alongside the initial implementation (which is what actually found both gaps in §2.1/§2.2 before any code shipped), and a second, fully independent pass specifically to verify those two fixes rather than take the first pass's word for it. The second review re-derived the SQL boolean logic from the migration files directly, cross-checked the seed's actual role/permission grants (confirming `secretary`/`chairman`/`vice_chairman` hold `management.agenda.manage` but not `super_admin`), confirmed `apps/web/lib/supabase/server.ts` wires a real user-scoped (not service-role) client so RLS genuinely runs under the caller's own session for every service-layer call, and checked for spoofable `createdBy`/`voterId` values. Findings:

- **No issues found — ship.** Both 0034 policies are correctly parenthesized with no precedence error; the NULL-handling case (a mis-scoped agenda with no `eligible_department_id`/`eligible_family_id` set) correctly evaluates to "not eligible" rather than true or erroring, and `createAgenda`'s own input validation (§1) makes that case unreachable through the UI regardless. The anonymity fix was confirmed to genuinely block a direct, app-bypassing query from a `management.agenda.manage` holder who isn't `super_admin` — not merely this phase's own UI choosing not to ask.
- **Confirmed by design, not a gap**: a manager can edit an agenda's eligibility scope after votes have already been cast, and `draft` agendas are visible to every signed-in user before being opened — both are pre-existing, unchanged trust-model decisions (the same "manage-permission holders are trusted with full CRUD, RLS is the only real gate" shape used throughout this codebase since Vendors, Phase 8.1), not new gaps introduced by this phase.
- **Confirmed no spoofing**: `createdBy` and `voterId` are resolved exclusively from `auth.getCurrentUserWithRoles(supabase).id` inside the Server Actions, never read from `formData`.
- **Confirmed the test suite is honest**: the unit-test fake client and the e2e mock server both explicitly document, in their own comments, that they apply no RLS and defer eligibility/anonymity verification to live Postgres — they do not fake a passing check that could mask a real regression.

## 5. Seed data changed this phase

None. `management.agenda.manage` and its grants to `secretary`/`chairman`/`vice_chairman`/`super_admin` were already present in `supabase/seed/001_reference_data.sql` since Phase 4, unused by any real caller until this phase.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` (workspace-wide) clean.
- 376/376 `@ngc/services` unit tests (359 pre-existing + 17 new across `agendas/{create,list,vote}.test.ts`: default/scoped/anonymous agenda creation and its validation, listing and result-view mapping, first-time and duplicate-vote handling, and per-caller vote listing).
- 67/67 Playwright e2e tests (65 pre-existing + 2 new `agendas.spec.ts` tests: a Secretary creating an agenda item and a plain member casting a vote and seeing their own recorded choice afterward, and a plain member confirmed to see the always-visible nav link but no creation form or individual-ballots section). Consistent with 9.1's own precedent for `contribution_campaign_summary`, this spec does not seed or assert on `agenda_results` — a real-Postgres view the mock's generic REST layer cannot compute from inserted rows — nor does it attempt to exercise 0034's RLS eligibility/anonymity logic, since the mock enforces no RLS at all; both are covered by the live-Postgres manual verification below instead.
- **Manual `psql` verification of migration 0034 against a live local Postgres instance** — seven checks, all passing: (1) an ineligible department's member is refused voting on a department-scoped agenda; (2) the eligible department's member succeeds; (3) a `management.agenda.manage` holder who is not `super_admin` gets zero rows querying an anonymous agenda's votes they didn't cast; (4) a true `super_admin` gets the full row back on that same anonymous agenda; (5) a voter can always read their own vote; (6) that same non-`super_admin` manager CAN read every row on a separate, non-anonymous agenda; (7) voting on a `closed` agenda is refused.
- Two independent adversarial security-review passes (Agent-dispatched) — findings in §4; no further bug required a fix before this sub-phase, and with it Phase 10 as a whole, was considered complete.

## 7. Open issues / deferred, not overlooked

- **No voter name resolution** in the individual-ballots list — a raw user ID is shown, matching this codebase's established plain-ID simplification elsewhere.
- **Constitution/Guidelines documents** are served through the still-unbuilt Documents module (0015) per 0017's own design note — no service layer or UI exists for it yet, the same gap named by 10.1 and 9.2.
- **A manager can edit an agenda's eligibility scope after votes exist**, and `draft` agendas are visible to every signed-in user before being formally opened — both confirmed-by-design (§4), not silently overlooked gaps.

Phase 10.4 (Agenda & Voting) is complete, and with it **all of Phase 10 (Communication: Announcements, Notifications, Calendar, Agenda & Voting) is complete and validated.** Per the Development Control Rule, Phase 11 requires its own explicit "proceed" instruction before any further work begins.
