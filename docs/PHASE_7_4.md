# PHASE_7_4.md — Phase 7.4 Deliverable
## Neema Gospel Choir (NGC) ERP — Discipline (confidential)

**Status:** Implemented across `packages/services` and `apps/web`, and verified against a real running Next.js server plus a real (mocked) Auth/PostgREST HTTP endpoint. Two migrations were added this phase — neither adds a table; `disciplinary_cases`/`disciplinary_actions` and their RLS (spec S33/S53: "no other role sees this by default") already existed from `0007_discipline.sql` (Phase 4). Both migrations, and why they were necessary, are covered in §5.

---

## 1. Scope (per the Development Control Rule)

Phase 7 as a whole was split into five sub-phases (see `docs/PHASE_7_1.md` §1):

- 7.1 — Directory foundation: Departments, Families, Members (delivered)
- 7.2 — Onboarding: the new-member application workflow (delivered)
- 7.3 — Attendance & Leave (delivered)
- **7.4 — Discipline (confidentiality-sensitive, standalone)** (this deliverable)
- 7.5 — Events/Invitations & the generic Approvals workflow engine — not started

7.4 covers PRD §9.4/§7.18: an authorized Discipline Manager opens a case (incident, category, description) against a member, moves it through investigation, records a decision (warning/suspension/probation extension/dismissal/other), and — for a suspension — later restores it with a required reason and audit record. This is explicitly the most confidentiality-sensitive module in the whole system: per spec S33/S53, "no other role — including Finance and even most HR views — sees this by default," and the PRD's own permission matrix gives even the Discipline Manager role only "Read (own cases only)" on Member Profiles, not general member read/write access.

Explicitly **deferred, not overlooked**:
- **Evidence document attachment** (`disciplinary_cases.evidence_document_ids`) — no Supabase Storage/documents module exists in this codebase yet (same deferral as Phase 7.2's application document uploads). The column exists at the DB level; there is no upload UI.
- **`probation_extension` → the actual `probation` module's deadline** — recording this action type is supported (it's a real, distinct fact worth capturing), but it does NOT extend `probation.deadline`; that cross-module wiring is a genuine interpretive gap the PRD doesn't fully specify (does "extend probation" mean N more days from today, from the original deadline, a fixed new date?) and is flagged here for confirmation with NGC leadership rather than guessed at.
- **Eligibility/attendance scoring reacting to discipline status** — PRD §7.10 ties event eligibility to "discipline status" among other factors; that belongs to the Events module (7.5) reading this module's data, not this phase producing it.
- **A member ever seeing their own case** — 0007's own migration comment is explicit that this must be a deliberate, separately-audited policy decision if NGC ever wants it, not a default. Nothing in this phase changes that; verified end-to-end (§7) that a member who IS the subject of a seeded case still cannot see it.

Dependencies / DB changes: **two migrations**, both narrowly scoped and both a direct consequence of this phase's own design/review process, not schema additions:
- `0026_discipline_member_access.sql` — the mechanism by which the Discipline Manager role (which the PRD gives NO general read/write grant on Member Profiles) can (a) see the name of a member who already has a case on file, (b) resolve a member by exact number when opening a NEW case, and (c) apply a suspension/dismissal/restoration to `members.membership_status` despite holding no direct write grant on that table.
- `0027_discipline_lookup_audit_and_hardening.sql` — two fixes from this phase's own security review (§5).

## 2. Architecture

```
packages/services/src/discipline/   Find-by-number, case CRUD/status, actions, restoration, categories
apps/web/app/(erp)/discipline/      Case list/create/detail, decision/restoration forms (RLS-scoped client)
supabase/migrations/0026, 0027      Member-access mechanism for a role with no general Member Profiles grant
```

### 2.1 No member picker — exact number lookup only

A Discipline Manager has no way to browse or search members (no `members.profiles.read_all`, no department scope) — `disciplinary_cases_select_discipline_only` RLS only lets them see a member who is ALREADY the subject of a case, which is never true for the member a brand-new case is being opened against. `create-case.ts`'s `createCase()` therefore takes a member NUMBER, not an id or a picker selection, and resolves it via `find_member_by_number_for_discipline()` (0026) — a SECURITY DEFINER function that does an EXACT match only (never `ilike`/search) and re-checks `discipline.cases.manage` itself. This is realistic: a Discipline Manager filing a case already knows the member's ID number from the incident report itself.

### 2.2 Status changes go through a purpose-built function, not an RLS grant

The PRD's permission matrix gives Discipline Manager **no write grant on Member Profiles at all** — not even a column-limited one (contrast with Phase 7.1's `0023` self-update column guard, which DOES grant HR a real update path). So when a suspension or dismissal is decided, `recordAction()` calls `apply_disciplinary_membership_status()` (0026) — a SECURITY DEFINER function that is the ONLY way this module ever touches `members.membership_status`. It re-checks `discipline.cases.manage`, allowlists exactly `suspended`/`active`/`exited`, and additionally requires the target member to already have a disciplinary case on file (the same scoping as the read policy) as defense-in-depth. Restoring a suspension (`restoreSuspension()`) calls the same function with `active`, but only if the member's current status is still `suspended` — a defensive check against clobbering an unrelated, later status change (e.g. a subsequent dismissal on a different case).

### 2.3 Case status is forward-only, and recording the first action IS the "action decided" step

`case-status.ts`'s `FORWARD_TRANSITIONS` mirrors Applications' (7.2) own forward-only state machine: `open → under_investigation → action_decided → resolved → closed`, no jump-ahead, no going back. PRD §9.4's flow chart has no separate manual "mark decided" step — `recordAction()` bumps the case to `action_decided` automatically the moment the first action is logged, if the case is still `open`/`under_investigation`.

### 2.4 A case can be worked on further even after `action_decided`

The UI (`discipline/[id]/page.tsx`) keeps offering "Record another action" while a case is `action_decided`, since a case can accumulate more than one action (e.g. a warning, then later a suspension) before it's actually resolved. `recordAction()` (security-review follow-up, §5) refuses a second active (unrestored) suspension or a second dismissal on the same case, to avoid a confusing duplicate record — but re-suspending after an earlier suspension on the same case has already been restored is explicitly still allowed.

## 3. UI

- **`/discipline`**: case list with a status filter; explicitly checks `discipline.cases.read`/`.manage` itself before rendering anything (see §2.5/§5) — a non-privileged visitor sees a plain "this is a confidential module" message, never an empty table that could be misread as "no cases exist."
- **`/discipline/new`**: opens a case — member number (exact), category (admin-configurable via `lookup_values`), incident date, description. Re-checks the permission directly (not just hidden from nav) since a direct URL visit bypasses the list page's own check.
- **`/discipline/[id]`**: case detail — overview, actions-taken history (each suspension showing its dates and, once restored, the restoration reason), and status-appropriate action cards (begin investigation / record a decision / resolve / close), each gated on `canManage` and the case's current status.
- **Sidebar nav**: a new "Discipline" group, but — unlike Attendance & Leave's always-visible group — this one IS permission-gated (`discipline.cases.read`/`.manage` only), since there is no "everyone sees their own" carve-out for this module at all.

## 4. A real bug found while building this phase (not a security issue — a test-infrastructure gap)

While writing `discipline.spec.ts`'s restoration test, a re-visit of the same `/members/[id]` URL within one test kept showing a stale `membership_status` after a real status change in between. Root cause, found by direct HTTP experimentation against the mock server in isolation (bypassing Next.js entirely to narrow it down): `apps/web/e2e/mock-gotrue-server.mjs`'s GET handler never honored postgrest-js's `.single()` `Accept: application/vnd.pgrst.object+json` header the way its POST/PATCH handlers already did — every plain `.select().eq(...).single()` READ (as opposed to an `.insert()/.update()...select().single()`, which already went through the existing `sendRepresentation()` helper) silently got back a one-item ARRAY instead of the bare object the calling code's TypeScript types promised. `restoreSuspension()`'s internal re-read of `membership_status` (`memberRow.membership_status === "suspended"`) was reading `undefined` off that array, so the reactivation branch never ran, even though the actual database state was correct.

This was not new to this phase — the identical `.select().eq(...).single()` re-read pattern already existed in Phase 7.2's `probation/fail.ts`/`complete.ts` (re-reading a member's name after updating them), just never through a code path a prior test happened to assert on. **Fixed** by routing the mock's GET handler through the same `sendRepresentation()` helper the POST/PATCH handlers already used, so `.single()` now behaves identically for every HTTP method — a strictly more-correct mock, not a narrower one. All 37 e2e tests (across all four spec files) still pass after this fix, including the ones that exercise the previously-silently-affected Phase 7.2 code paths.

Separately, while chasing this same symptom before finding its real cause, a related but independent hardening was also applied: `packages/db/src/server-client.ts`'s Supabase client now forces `cache: "no-store"` on every fetch. This addresses a real (if, in this instance, not the proven cause) Next.js 14 default — `fetch()` calls default to `cache: "force-cache"` regardless of whether the route is dynamically rendered — which could otherwise let any page in this app silently serve a stale read after a mutation in a real deployment, not just in this test.

## 5. Security review

A dedicated review pass (a separate agent, briefed adversarially against this exact module) traced every service function, every page/action, and the actual SQL in `0026` — not just the doc comments — for: confidential-data leakage, whether the exact-number lookup could be abused as an oracle, whether the status-change function could be bypassed, whether any Server Action trusts client-supplied identity, and whether the in-page permission checks are complete and correctly ordered. Verified clean: `officerId`/`decidedBy`/`restoredBy` are always server-derived from the authenticated session, never from `formData`; no path lets a caller supply a raw member id (everything resolves through the exact-number lookup); the lookup function returns the identical empty result whether the caller lacks permission or the member simply doesn't exist (not usable to distinguish the two); `apply_disciplinary_membership_status` correctly re-checks the permission, the status allowlist, and the "member has a case on file" scoping in its actual function body; `restoreSuspension()` correctly guards against clobbering an unrelated later status change; every discipline page checks its permission BEFORE fetching any case data; and no confidential text is ever rendered via `dangerouslySetInnerHTML`.

Three real findings were surfaced, and all three have been addressed in this same pass:

- **(Medium) Member-number enumeration risk.** `find_member_by_number_for_discipline()`'s exact-match design is correct in principle, but `member_number` is sequential and predictable (`NGC-{year}-{sequence}`) — a Discipline Manager account (compromised, or an insider acting outside their remit) could iterate plausible numbers to harvest name + status for the entire membership directory, well beyond the PRD's "Read (own cases only)" grant. This requires the permission already, so it is not an authorization *bypass* — it is a scope-creep/insider-risk concern. **This codebase has no request-rate-limiting infrastructure anywhere**, so outright prevention is out of scope for this phase; the mitigation applied (`0027`) is detective, not preventive: every call — match or no match — is now written to `audit_logs` with the queried number and whether it matched, so a pattern of many distinct lookups in a short window is visible to whoever reviews the audit log. **This residual risk is explicitly flagged, not claimed as solved** — a real rate-limiting mechanism (or restricting this role to fewer, pre-vetted individuals at the organizational level) would need to be a deliberate follow-up if NGC leadership judges the residual risk too high.
- **(Low) `members_select_discipline_scoped` checked only `discipline.cases.read`,** relying on seed data always pairing it with `.manage` on the Discipline Manager role rather than the policy itself being robust to that pairing ever changing. `0027` broadens the check to `.read OR .manage` directly. (`0007`'s own pre-existing `disciplinary_cases_select_discipline_only` policy has the identical single-permission pattern — left untouched, as it's already shipped/tested Phase 4 code outside this phase's scope to revisit.)
- **(Low) `recordAction()` allowed an unbounded second `suspension`/`dismissal` on the same case.** Neither action's membership-status side effect would have corrupted data (the underlying function is idempotent), but both would leave confusing duplicate action rows, and a second suspension specifically complicates `restoreSuspension()`'s bookkeeping (which action is "the" active one?). Fixed in `record-action.ts`: a new suspension is refused while an earlier one on the same case is still active (unrestored); a second dismissal is refused outright. Re-suspending after an earlier suspension on the same case has already been restored is still explicitly allowed.

## 6. Migrations added this phase

- `0026_discipline_member_access.sql` — `members_select_discipline_scoped` RLS policy (read-only, case-scoped); `find_member_by_number_for_discipline()`; `apply_disciplinary_membership_status()`. No table/column changes.
- `0027_discipline_lookup_audit_and_hardening.sql` — broadens `members_select_discipline_scoped` to `.read OR .manage`; adds an `audit_logs` write to every call of `find_member_by_number_for_discipline()`. No table/column changes.

## 7. Validation performed

- **Unit tests:** `pnpm --filter @ngc/services test` → **144/144 pass**, including every prior phase's tests unaffected. New this phase: 3 find-member, 3 create-case, 5 list/get/list-actions, 3 case-status, 8 record-action (including the 3 new duplicate-action-guard tests), 5 restore-suspension, 1 categories.
- **Full monorepo gates:** `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass clean across all 8 workspace packages, re-run after every fix in this document.
- **End-to-end (Playwright, real Next.js server + real mock Auth/PostgREST server, `apps/web/e2e/discipline.spec.ts`, 8 tests, all passing):** a Discipline Manager opens a new case by exact member number; opening a case against an unknown number shows a clear error, not a crash; recording a warning auto-advances the case to `action_decided`; a suspension changes the member's status and restoring it changes it back (verified from the Member Profiles side via a separate HR identity, confirming the cross-module status write actually lands); a dismissal exits the member with a reason referencing the case; resolving then closing a case moves through both final states; HR — despite holding full Member Profiles management — cannot see the confidential module at all; and a member cannot see the module even though an existing case concerns them. Combined with `auth.spec.ts` (7), `directory.spec.ts` (8), `onboarding.spec.ts` (7), and `attendance-leave.spec.ts` (7), the full suite is **37/37 passing**.
- **The mock-server `.single()` bug (§4) was found and fixed as part of this validation, not by inspection alone** — it surfaced only because this phase's test design happened to re-visit the same URL twice within one test after a real mutation, a pattern no prior phase's tests exercised.

## 8. Open issues / deferred, not overlooked

- No evidence document attachment UI (no Supabase Storage integration in this codebase yet) — §1.
- `probation_extension` actions are recorded as a fact but do not extend the actual `probation.deadline` — flagged for confirmation on what "extend" should mean (relative to today vs. the original deadline) — §1.
- Event eligibility scoring reading discipline status belongs to the Events module (7.5), not this phase — §1.
- **Member-number enumeration by a Discipline Manager is a flagged, unresolved residual risk** — mitigated with an audit trail (detective), not prevented (no rate-limiting infrastructure exists in this codebase) — §5.
- As with every prior phase, the multi-step writes here (insert action → membership-status RPC → case-status update) are not atomic across their steps — same documented, non-silent limitation as every other multi-step write in this codebase.
