# PHASE_7_3.md — Phase 7.3 Deliverable
## Neema Gospel Choir (NGC) ERP — Attendance & Leave

**Status:** Implemented across `packages/services` and `apps/web`, and verified against a real running Next.js server plus a real (mocked) Auth/PostgREST HTTP endpoint. One migration was added this phase, but not to add new tables — `attendance_sessions`, `attendance`, `leave_requests`, `member_attendance_summary`, and every RLS policy governing them already existed from `0006_attendance_leave.sql` (Phase 4). The migration added here (`0025`) is a security fix, described in §5.

---

## 1. Scope (per the Development Control Rule)

Phase 7 as a whole was split into five sub-phases (see `docs/PHASE_7_1.md` §1):

- 7.1 — Directory foundation: Departments, Families, Members (delivered)
- 7.2 — Onboarding: the new-member application workflow (delivered)
- **7.3 — Attendance & Leave** (this deliverable)
- 7.4 — Discipline (confidentiality-sensitive, standalone) — not started
- 7.5 — Events/Invitations & the generic Approvals workflow engine — not started

7.3 covers PRD §S25-S27: creating attendance sessions (rehearsal, meeting, department meeting, or other — see deferral below), marking a session's roster present/absent/late/custom-status with notes, a rolling per-member attendance percentage, and the leave-request lifecycle (a member submits a leave request; HR/a department leader approves or rejects it with an optional comment).

Explicitly **deferred, not overlooked**:
- **`event` session type / QR / mobile check-in** — `attendance_sessions.session_type` allows `'event'` at the DB level (0006/0008), but Events don't exist as a module yet (Phase 7.5); this phase's UI only ever creates rehearsal/meeting/department_meeting/other sessions. `attendance.recorded_via` already models `qr`/`mobile`/`web` as valid values for a future check-in flow; every write from this phase's UI records `recorded_via: 'manual'`.
- **Automated eligibility scoring / automatic inactivity-flagging** — the PRD ties attendance percentage to disciplinary/eligibility rules; that logic belongs to Discipline (7.4) and reads `member_attendance_summary` once it exists, not this phase.
- **Offline sync conflict resolution** — `attendance.client_idempotency_key` exists in the schema for a future mobile offline-capture flow; this phase's web UI never sets it.

Dependencies / DB changes: **one migration, `0025_view_security_invoker.sql`**, added mid-phase as a direct result of this phase's own security review (§5) — it does not add tables or columns, only closes an RLS-bypass gap in three pre-existing views. Full detail in §5.

## 2. Architecture

```
packages/services/src/attendance/   Sessions, roster, record, statuses, member summary
packages/services/src/leave/        Create, list/get, decide
apps/web/app/(erp)/attendance/      Session list/create/detail, roster marking (RLS-scoped client)
apps/web/app/(erp)/leave/           Leave list/create/detail, approve/reject (RLS-scoped client)
```

### 2.1 Roster resolution

A session's roster is computed, not stored: for a department-scoped session it's every member whose `primary_department_id` matches, for a whole-choir session (`department_id is null`) it's every member — in both cases excluding `membership_status = 'exited'` — left-joined against whatever `attendance` rows already exist for that session. This is two flat queries (get eligible members, get existing attendance rows, join in JS), consistent with the "no embedded selects, the hand-generated `Database` type has no relationship metadata" pattern established since Phase 6.

### 2.2 Recording attendance is check-then-write, not `.upsert()`

`recordAttendance()` does a `.maybeSingle()` check against the table's own `unique (session_id, member_id)` constraint, then either updates the existing row or inserts a new one — the same "explicit multi-step write over a single convenience method" preference used throughout this codebase (e.g. `assignDepartment()`'s own check-then-write shape).

### 2.3 RLS is the real gate; the UI mirrors it, doesn't duplicate it loosely

Every Server Action here uses the normal cookie-bound RLS-scoped client. `attendance_sessions_write_scoped`/`attendance_write_scoped` (0006) allow a write when the caller holds `attendance.records.manage` **or** the session's `department_id` is in `current_user_department_ids()` — critically, a `NULL` `department_id` (whole-choir session) is never "in" that list, so a department-scoped role alone never covers a whole-choir session, only the global permission does. `attendance/[id]/page.tsx`'s `canManage` was written to match this exactly:

```
currentUser.permissionCodes.includes('attendance.records.manage') ||
  (session.departmentId && currentUser.roles.some(r => r.scopeType === 'department' && r.scopeId === session.departmentId))
```

This was verified end-to-end by a dedicated e2e test: a department-scoped leader can create/mark attendance for their own department's session, but cannot manage a whole-choir session even though they can see it.

### 2.4 Leave requests always resolve to the caller's own member record

`createLeaveRequestAction` always submits `currentUser.member.id` — never a client-supplied value — both because `leave_requests_insert_self` RLS enforces this independently and as good practice against a tampered form field.

### 2.5 Admin-configurable statuses, not a hardcoded enum

Attendance statuses (`present`, `absent`, `late`, ...) are rows in `lookup_values(category='attendance_status')`, not a fixed application-level enum, per spec S25 ("+ Other configurable status"). `metadata.counts_as_present` drives both the summary view's percentage calculation and the roster UI's status tone. This module reads that same table (`listAttendanceStatuses()`) rather than hardcoding a parallel list, and — following this phase's security review — also validates every write against it (§5, Finding 2).

## 3. UI

- **`/attendance`**: session list with department/date-range filters; "New session" link visible only to a global manager or a department-scoped role holder.
- **`/attendance/new`**: session creation form; the same visibility check is re-applied here (not just hidden in the nav), since a direct URL visit bypasses whatever the list page chose to render.
- **`/attendance/[id]`**: session detail; roster shown and editable only when `canManage` (§2.3), otherwise a plain "you don't have permission" message — RLS would reject the write either way, but the UI doesn't offer an affordance that would just fail.
- **`/leave`**: a manager/HR sees every leave request; anyone else sees only their own (`memberId: canManage ? undefined : currentUser?.member?.id` — safe even for a permissionless, memberless viewer, since RLS independently scopes the result set regardless of what this filter passes).
- **`/leave/new`**: submit a leave request (emergency/planned/absence-explanation/other, date range, reason); refuses to render if the signed-in user has no resolved `member` record.
- **`/leave/[id]`**: detail; Approve/Reject decision cards (each with an optional comment) render only when `canManage && status === 'pending'`.
- **Member detail page (`members/[id]`)**: a new "Attendance" card shows the member's attendance percentage, present count, and sessions-recorded count (or a "no attendance recorded yet" message) — an additive change to the existing Phase 7.1 page, not a new route.
- **Sidebar nav**: a new "Attendance & Leave" group (Attendance, Leave) — deliberately **always visible**, unlike Onboarding's permission-gated group, because RLS already scopes both modules down to "my own records" for anyone without a manage/read-all permission or department scope, so every signed-in member has a legitimate reason to see their own attendance history and leave requests.

## 4. A real bug found while building this phase

None this phase at the application-logic level (unlike Phase 7.2's render-loop bug) — the two issues found were both surfaced by the security review rather than by test failures, and are covered in full in §5 rather than here, since both are security/data-integrity findings, not functional bugs caught by a failing test.

## 5. Security review

A dedicated review pass (a separate agent, briefed adversarially) checked this phase's code against: whether Server Actions ever use a non-RLS-scoped (service-role) client; whether `canManage`'s whole-choir-session exclusion is actually complete; whether `createLeaveRequestAction` can be tricked into submitting on another member's behalf; whether the leave list's scoping is safe for every kind of viewer, including one with no resolved member record; and whether any freeform text (notes, decision comments) is rendered unsafely. Five of seven checked items were clean:

- No Server Action under `apps/web/app/(erp)/attendance/**` or `.../leave/**` uses a service-role client — every one uses the cookie-bound RLS-scoped client, same as Phase 7.1/7.2.
- `canManage` in `attendance/[id]/page.tsx` correctly mirrors `attendance_write_scoped`, including the whole-choir exclusion (§2.3), verified by a passing adversarial e2e test.
- `createLeaveRequestAction` never trusts a client-supplied member id (§2.4).
- The leave list page's `memberId` scoping (`canManage ? undefined : currentUser?.member?.id`) is safe even for a permissionless/memberless account — RLS independently backstops the result set regardless.
- No `dangerouslySetInnerHTML` anywhere in the new code; freeform text (leave reasons, approver comments, roster notes) is rendered via plain JSX interpolation.

Two real findings were surfaced and **both have been fixed in this same pass**, consistent with this codebase's established practice (Phase 7.1's `0023` migration, Phase 7.2's UI-permission fixes) of actually closing a security-review finding rather than only documenting it:

### Finding 1 (high) — `member_attendance_summary` could bypass RLS entirely

The view (0006) was declared as a plain `create view`, with no `security_invoker` setting. Postgres views default to running with the **view owner's** privileges, not the querying role's — meaning the RLS policies on the base tables the view reads (`attendance_select_scoped`, and `members` indirectly) were not actually being enforced for whoever queried the view. My own doc comment in `packages/services/src/attendance/summary.ts` originally claimed the opposite ("a view has no RLS of its own... it runs with the querying role's privileges") — that claim was wrong, and has been corrected.

The concrete exposure: this phase added an unconditional call to `getMemberAttendanceSummary()` on the Member detail page. Without the fix, **any viewer who could load a given member's profile at all** — including someone who can see it only via `members_select_scoped`'s family-scope grant, which has nothing to do with attendance — could see that member's exact attendance percentage, present count, and sessions-recorded count, even with zero attendance-record visibility of their own (no `attendance.records.read_all`, no overlapping department scope). This is a genuine data leak, not just an availability quirk.

**Fix:** `supabase/migrations/0025_view_security_invoker.sql` sets `security_invoker = true` on `member_attendance_summary`, making it evaluate under the caller's own role and therefore under `attendance_select_scoped`/`members_select_scoped`, exactly as if the query read the base tables directly. While fixing this, the same latent bug was found in two other pre-existing views from earlier migrations — `contribution_campaign_summary` (0014, Finance) and `agenda_results` (0017, Governance) — neither of which has application code reading it yet (those UI phases haven't been built), but both would have reproduced this exact finding the day someone did. All three were fixed in the same migration rather than leaving two of them as a known landmine. The doc comment in `summary.ts` was corrected to describe the actual mechanism and to flag why `security_invoker` must not be silently dropped in a future migration.

### Finding 2 (low) — `recordAttendance()`'s status code wasn't validated against real data

`attendance.status_code` is deliberately free text at the DB level (admin-configurable via `lookup_values`, not a fixed enum, per spec S25), and `recordAttendance()` originally only checked that it was non-blank. Since RLS governs *who* can write, not *what value* they write, an already-authorized caller (anyone with session-write access) could have persisted an arbitrary status string. That string would then silently fail to match any `lookup_values` row in `member_attendance_summary`'s join (counted as "not present," same as an actual absence) while `roster-table.tsx` would display the row as though nothing had been recorded at all — a data-integrity and UX inconsistency, not a permissions bypass.

**Fix:** `recordAttendance()` now looks up the submitted `statusCode` against `lookup_values(category='attendance_status', is_active=true)` and rejects the write with a clear error ("... is not a recognized attendance status") if no match is found. A new unit test confirms both an unknown code and a retired (`is_active=false`) code are rejected, and that no row is written in either case. This does not affect any real usage path — `listAttendanceStatuses()` is what populates the roster's status `<select>`, so an honest client never submits anything but a valid, active code; only a tampered request is affected.

## 6. Migrations added this phase

- `0025_view_security_invoker.sql` — sets `security_invoker = true` on `member_attendance_summary`, `contribution_campaign_summary`, and `agenda_results` (§5, Finding 1). No table/column changes.

## 7. Validation performed

- **Unit tests:** `pnpm --filter @ngc/services test` → **116/116 pass**, including every Phase 7.1/7.2 test unaffected. New this phase: 5 sessions, 1 statuses, 4 roster, 4 record (the 4th added post-review to cover Finding 2), 2 summary, 3 leave-create, 4 leave-list, 3 leave-decide.
- **Full monorepo gates:** `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass clean across all 8 workspace packages, re-run after both security fixes.
- **End-to-end (Playwright, real Next.js server + real mock Auth/PostgREST server, `apps/web/e2e/attendance-leave.spec.ts`, 7 tests, all passing, re-run after both security fixes):** HR creates a whole-choir session and marks a member present; a department-scoped session's roster correctly excludes other-department and exited members; a department-scoped leader creates and marks attendance for their own department; a department-scoped leader cannot manage a whole-choir session; a member submits a leave request and HR approves it with a comment; a member sees only their own leave requests and their own attendance percentage on their profile; HR rejects a leave request with a comment. Combined with `auth.spec.ts` (7), `directory.spec.ts` (8), and `onboarding.spec.ts` (7), the full suite is **29/29 passing**.
- **The two security findings were found by a dedicated adversarial review pass, not by a failing test** — neither the unit tests nor the e2e suite would have caught either issue on their own (the mock PostgREST server doesn't model RLS or view-owner semantics at all); both were confirmed by reading the actual migration SQL and the actual service code against Postgres's real view-privilege rules, then fixed and re-verified against the full gate suite.

## 8. Open issues / deferred, not overlooked

- No `event` session type / QR / mobile check-in yet — waiting on the Events module (7.5); the schema already supports both — §1.
- No automated eligibility scoring or automatic inactivity-flagging from attendance percentage — that belongs to Discipline (7.4) — §1.
- No offline-sync conflict resolution using `client_idempotency_key` — no mobile app exists yet to populate it — §1.
- `contribution_campaign_summary` (Finance, 0014) and `agenda_results` (Governance, 0017) were fixed for the same `security_invoker` gap as a precaution, but neither has been otherwise reviewed as part of this phase — their own UI phases should still get a full security review when built, not treat this fix as a substitute for one.
- As with every prior phase, the multi-step writes here (check-then-insert-or-update in `recordAttendance()`) are not atomic across their steps — same documented, non-silent limitation as Phase 7.1/7.2's own multi-step writes.
