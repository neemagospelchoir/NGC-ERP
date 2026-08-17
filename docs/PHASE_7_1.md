# PHASE_7_1.md — Phase 7.1 Deliverable
## Neema Gospel Choir (NGC) ERP — Directory (Departments, Families, Members)

**Status:** Implemented across `supabase/migrations`, `packages/services`, and `apps/web`, and verified against a real running Next.js server plus a real (mocked) Auth/PostgREST HTTP endpoint — see §7 for what was actually run, not just written.

---

## 1. Scope (per the Development Control Rule)

Phase 7 as a whole (PRD.md's Users, Members, Departments, Families, Onboarding, Attendance, Leave, Discipline, Events/Invitations, Approvals) was too large to build as a single undifferentiated pass without violating the Development Control Rule's own "one module at a time, verified before the next begins" principle. It was split into five sub-phases; this document covers only the first:

- **7.1 — Directory foundation: Departments, Families, Members** (this deliverable)
- 7.2 — Onboarding (applications workflow) — not started
- 7.3 — Attendance & Leave — not started
- 7.4 — Discipline (confidentiality-sensitive, standalone) — not started
- 7.5 — Events/Invitations & the generic Approvals workflow engine — not started

7.1 covers: listing/creating/editing/deactivating Departments and Families (reference/org-structure entities); listing (with status/department/family/name-search filters), creating, and viewing/editing Members; the self-service vs. HR-managed field split on a member's own record; and department/family (re)assignment with a full history log. It does **not** cover: the Applications/Onboarding intake flow that will be the primary way members get created in production (7.2); Attendance/Leave/Discipline; bulk import; or member photo upload (the `photo_url` field exists and is editable, but there is no upload UI yet — out of scope until a file-storage phase).

Dependencies / DB changes: the `departments`, `families`, `members`, `member_departments`, and `member_families` tables and their RLS policies already existed from Phase 4 (`0003_lookup_and_org_structure.sql`, `0004_members.sql`) — Phase 7.1 needed no new tables. Two new migrations were added, both closing gaps discovered while building this phase (§6): `0023_members_self_update_column_guard.sql` (a real RBAC gap) and `0024_local_dev_role_grants.sql` (a local-dev testing-fidelity gap). Both are described in full in §6.

## 2. Architecture

```
packages/services/src/departments/   Department CRUD (never hard-deleted — deactivate/reactivate only)
packages/services/src/families/      Family CRUD (same shape as departments)
packages/services/src/members/       Member read/list, create, self-service vs. HR update, department/family (re)assignment
packages/services/src/shared/        ServiceError (shared across all three modules) + a superset test fixture
apps/web/app/(erp)/departments/      List + create + detail/edit + deactivate UI
apps/web/app/(erp)/families/         Same shape as departments
apps/web/app/(erp)/members/          List (filters+search) + create + detail (branches by permission/identity) UI
```

### 2.1 Departments and Families

Both are simple reference entities: `{id, name, description, leaderUserId?, isActive, createdAt, updatedAt}`. Per the master "never destroy historical data" rule, there is no delete — only `deactivateDepartment`/`reactivateDepartment` (an `is_active` toggle), which drops a department out of `listDepartments()`'s default view and any active-picker while leaving every past assignment/reference intact. The service layer applies no permission check itself; `departments_read_authenticated`/`families_read_authenticated` RLS (0003) already let any signed-in user read, and `departments_write_admin`/`families_write_admin` RLS already gate writes on `admin.departments.manage`/`admin.families.manage`. The UI hides the create form and the deactivate/reactivate control from anyone lacking that permission (§5) — a UX nicety, not the actual gate.

### 2.2 Members

`members` is the richest of the three. The service layer's central design decision is a strict split between what a member may change on their **own** record and what only HR may change on **anyone's** record:

- `MemberContactInfoInput` — self-editable fields (name, preferred name, gender, nationality, contact details, address, emergency contact). Used by `updateMemberContactInfo()`.
- `MemberRecordInput extends MemberContactInfoInput` — adds HR-only fields (middle name, DOB, national ID, membership status, joined/exited dates, exit reason). **Deliberately excludes** `primaryDepartmentId`/`familyId` — even HR cannot set those through this function. Used by `updateMemberRecord()`.
- `CreateMemberInput` — excludes `membershipStatus` entirely; every direct creation starts in `probation` (`createMember()` sets this explicitly in the insert, not relying on the column default, so the fixture-based unit tests actually exercise it rather than trusting an untested default).

This is enforced twice, deliberately: `MemberContactInfoInput`'s shape makes it a **compile error**, not just a runtime rejection, to build a self-service form that tries to send a restricted field (TypeScript catches it at the call site). The database's own `enforce_members_self_update_column_guard` trigger (0023, see §6) is the actual non-bypassable gate — the same defense-in-depth pattern Phase 6's `authorize()` established for permissions generally.

Department/family assignment is its own pair of functions, `assignDepartment()`/`assignFamily()`, never folded into the generic update functions — see §2.3.

### 2.3 Assignment history

`members.primary_department_id`/`family_id` are denormalized "current" pointers; `member_departments`/`member_families` are the append-only historical log (PRD spec S12: "assignment changes must be recorded"). `assignDepartment()`/`assignFamily()` are the *only* way either can change, and each performs three writes:

1. Close out the previous current assignment of the same kind (`is_current = false, ended_at = now()`).
2. Insert the new assignment row (recording `changed_by` — the signed-in HR user's ID — and optional `notes`).
3. Update the denormalized pointer on `members` to match.

A department assignment can be `"primary"` (steps 1–3 all run) or `"secondary"` (only step 2 runs — a member may hold more than one secondary department at once, and the primary pointer is untouched). A family assignment has no primary/secondary split (one current family at a time), so it always runs all three steps.

**Known, documented limitation:** these are sequential PostgREST calls, not one Postgres transaction (supabase-js has no raw multi-statement transaction support) — a failure between steps could leave the history and the denormalized pointer briefly inconsistent. This is called out in the code (not silently assumed away); a small `SECURITY INVOKER` RPC wrapping all three writes in one transaction would close this if it proves to matter in practice. RLS itself is unaffected either way, since every statement still runs under the caller's own RLS-scoped client.

### 2.4 Name resolution without embedded selects

Because `packages/db`'s hand-generated `Database` type has no relationship metadata, PostgREST's embedded-select syntax (`department:departments(name)`) does not type-check against it — the same limitation Phase 6's `getCurrentUserWithRoles` ran into. `resolveDepartmentAndFamilyNames()` instead issues two flat queries (distinct department IDs, distinct family IDs) and joins client-side. Slightly more round trips; simple, fully typed, and trivially fakeable in tests.

## 3. UI

- **Departments / Families** (`/departments`, `/families`, `/departments/[id]`, `/families/[id]`): list with inline create form; detail page with edit form and deactivate/reactivate. Both the create form and the deactivate control are hidden from anyone without the relevant `admin.*.manage` permission (§5).
- **Members list** (`/members`): filters (status, department, family, name search) are plain GET query params — every filter combination is a bookmarkable/shareable URL, and the filtering happens server-side via `listMembers()`'s options, which is what actually scopes the RLS-governed query. "Add member" is hidden without `members.profiles.manage`.
- **Members create** (`/members/new`): the HR "add a member manually" path. Refuses outright (an `ErrorState`, no form rendered) if the signed-in user lacks `members.profiles.manage` — `/members/new` is reachable by URL regardless of what the list page shows, so this is a real check, not just a hidden button. Always creates in `probation`; the Onboarding module (7.2) will be the applicant-review alternative.
- **Members detail** (`/members/[id]`): branches three ways on the signed-in user:
  1. Holds `members.profiles.manage` → the full HR record form, plus department/family reassignment forms.
  2. Is the member themselves (no such permission) → the self-service contact-info form only.
  3. Neither → read-only display of a few contact fields, no form at all (RLS already decided the row is visible to them at all — e.g. same-department scope — but rendering an edit form that would only be rejected on submit is poor UX, not a security boundary either way).

## 4. Client/server boundary bug found while building this phase

`DepartmentsTable`/`FamiliesTable`/`MembersTable` (`apps/web/app/(erp)/*/[…]-table.tsx`) exist because the original pattern — a Server Component page defining `TableColumn[]` (with `render: (row) => <JSX/>` closures) and passing that array as a prop into `<Table>` (a Client Component, `"use client"`, because it accepts `onRowClick`/`onSort` handlers) — is invalid: **a Server Component cannot pass a function prop into a Client Component.** React throws `Functions cannot be passed directly to Client Components...` at render time. This had been silently present in the Departments and Families pages since they were first built earlier in this sub-phase, undetected because no Playwright test had rendered either page yet — a direct instance of the "never claim something works without running it" risk. It surfaced the moment `directory.spec.ts` actually loaded `/departments` in a real browser against a real server. Fixed by moving the column definitions (and their render closures) into small `"use client"` wrapper components that take only plain, serializable `rows` data as their prop; the Server Component pages now fetch data and pass rows only. All three list pages (Departments, Families, Members) had this same latent bug and received the same fix.

## 5. Security review

- **Reused, not reinvented:** Phase 7.1 added no new RLS policies. `departments_read_authenticated`/`write_admin`, `families_read_authenticated`/`write_admin` (0003), and `members_select_scoped`/`update_self_limited`/`write_hr`, `member_departments_select_scoped`/`write_hr`, `member_families_select_scoped`/`write_hr` (0004) were already in place and already adversarially tested in earlier phases. This phase's job was to build a service layer and UI that trust those policies rather than re-implement authorization in the application layer.
- **A real gap found and closed (0023):** `members_update_self_limited`'s RLS `USING` clause only restricts which *rows* a self-update can touch, not which *columns* — Postgres RLS has no column-level granularity. A member could otherwise `UPDATE members SET membership_status = 'active', national_id_number = '...' WHERE id = <their own row>` and have it pass RLS entirely, despite the UI never offering such a form. Closed with a new `BEFORE UPDATE` trigger, `enforce_members_self_update_column_guard`, that raises `42501` if a *non-privileged self-update* (caller is the row's own `user_id` and lacks `members.profiles.manage`) changes any of: `national_id_number, date_of_birth, member_number, user_id, application_id, primary_department_id, family_id, membership_status, joined_at, exited_at, exit_reason, qr_token`. HR/admin callers and service-role/no-JWT contexts are untouched. Verified adversarially against a real local Postgres instance (§7).
- **UI-level permission gating added, on top of RLS:** the Members detail page's three-way branch (manage / self / read-only) was already permission-aware. While reviewing this phase, the Departments/Families create-forms and deactivate controls, the Members list's "Add member" button, and the `/members/new` page itself were found to render/allow access unconditionally regardless of the signed-in user's permissions — RLS would still correctly reject the eventual write, but a non-privileged user would see forms they had no reason to see and get a generic failure message instead of a clear one. This was fixed (not just noted) in this same pass: all four now check the relevant permission (`admin.departments.manage`, `admin.families.manage`, `members.profiles.manage`) before rendering, and `/members/new` re-checks directly (since it is reachable by URL regardless of what the list page shows) rather than trusting that the button was hidden. Covered by a dedicated Playwright test (§7).
- **Assignment actions rely on RLS, deliberately:** `assignDepartmentAction`/`assignFamilyAction` (Server Actions) do not perform an app-layer permission check before calling `assignDepartment()`/`assignFamily()` — consistent with the rest of this phase's "RLS is the real gate" pattern. `member_departments_write_hr`/`member_families_write_hr` (`for all using (has_permission('members.profiles.manage'))`) reject the INSERT/UPDATE outright for anyone lacking the permission, and `members_update_self_limited` plus the 0023 trigger reject a self-attempted primary-department/family change the same way. The UI only *renders* these forms when `canManage` is true (§3); a direct POST to the action would still be rejected by Postgres, not silently accepted.
- **A local-dev testing-fidelity gap found and closed (0024):** adversarial RLS testing against this sandbox's bespoke local Postgres instance revealed the `authenticated` role had *zero* table grants at all — not even `SELECT` — meaning every query failed on privilege-denied before RLS was ever evaluated. A real Supabase project auto-grants broad table privileges to `anon`/`authenticated` and relies on RLS as the actual gate; this sandbox's instance had never replicated that. Closed with `0024_local_dev_role_grants.sql` (guarded to only ever run against the local-dev shim, never a real Supabase project), which grants `SELECT/INSERT/UPDATE/DELETE` on all current and future tables to `anon`/`authenticated`, then re-applies 0022's `_id_sequences` revoke so that narrower restriction isn't reopened. Without this fix, every RLS test in this sandbox going forward — this phase's and every future one's — would have been unreliable.

## 6. Migrations added this phase

- **`0023_members_self_update_column_guard.sql`** — the column-level guard trigger described in §5. Implemented as `security definer set search_path = public` (mirroring `has_permission()`'s own pattern), because a plain `authenticated`-role caller has no `USAGE` grant on the `auth` schema and would otherwise get `permission denied for schema auth` the moment the trigger called `auth.uid()`.
- **`0024_local_dev_role_grants.sql`** — the local-dev-only role-grant fix described in §5.

Both were verified via (a) direct adversarial `psql` sessions (`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL app.current_user_id = '<uuid>'; <query>; ROLLBACK;`) and (b) a full from-scratch `pnpm run db:migrate`-equivalent apply against a freshly created database — all 24 migrations apply cleanly in order.

## 7. Validation performed

- **Unit tests:** `pnpm --filter @ngc/services test` → **51/51 pass** (23 auth + 7 departments + 4 families + 17 members), including: department/family create/list/update/deactivate/reactivate and duplicate-name rejection; member list filtering (status/department/family/search) and name resolution; member creation (Member ID format read + RPC call, fallback format, blank-name rejection, always-`probation`); self-service contact-info update (only allowlisted fields change, even against a bypass attempt using an `as any`-cast payload); HR record update (`membershipStatus`/national ID changeable); department/family assignment (primary close-and-replace, secondary leaves primary untouched, `endDepartmentAssignment`).
- **Adversarial database tests** (real local Postgres, non-superuser `authenticated` role): (1) self-scoped `SELECT` succeeds after the 0024 role-grant fix; (2) non-privileged self-update of `membership_status` fails with the 0023 trigger's custom error; (3) non-privileged self-update of `phone` (self-editable) succeeds; (4) non-privileged self-update of `national_id_number` (HR-only) fails; (5) an HR-permissioned caller updating `membership_status` on another member's row succeeds.
- **Full monorepo gates:** `pnpm typecheck`, `pnpm lint`, and `pnpm build` (with placeholder env vars) all pass clean across all 8 workspace packages.
- **End-to-end (Playwright, real Next.js server + real mock Auth/PostgREST server, `apps/web/e2e/directory.spec.ts`, 8 tests, all passing):** departments list/create/edit/deactivate; families list/create; members list with status filtering; HR adds a member (lands in probation); HR edits a member's full record and reassigns department and family (history + denormalized pointer both update, visible in the UI immediately); a member edits their own contact info but sees no HR-only fields or reassignment controls; a member viewing someone else's profile sees read-only fields and no form; a non-HR member is denied the write affordances (button hidden, `/members/new` refuses directly, create-forms and deactivate controls absent on Departments/Families) even navigating by direct URL. Combined with `auth.spec.ts`'s 7 tests, the full suite is **15/15 passing**.
- **Mock server extended, not stubbed:** `apps/web/e2e/mock-gotrue-server.mjs` gained generic POST (insert) / PATCH (update) handling for any table, an `ilike`/`or` filter implementation (Members' name search uses both), `order`/`limit`, and a dispatch table for the one Postgres RPC the web app calls directly (`next_formatted_id`, replicating its `{year}`/`{sequence}` templating and per-key/year counter). It does not attempt to replicate RLS, unique-constraint violations, or transactional atomicity — those are exercised by the adversarial `psql` tests and the `@ngc/services` unit test fixtures respectively; this server exists only to exercise the real Next.js request/response wiring end-to-end.

## 8. Open issues / deferred, not overlooked

- Assignment history writes are not atomic across their three steps (§2.3) — documented, not yet built as an RPC.
- No bulk member import — expected to arrive with or after Onboarding (7.2).
- No member photo upload UI (`photo_url` is a plain editable text field for now — no file storage integration yet).
- `SidebarNav`'s active-item highlighting uses a longest-matching-prefix heuristic across `href`s (so `/members/<id>` highlights "Members"); this is a client-side cosmetic concern only, unrelated to access control.
