# PHASE_7_2.md — Phase 7.2 Deliverable
## Neema Gospel Choir (NGC) ERP — Onboarding (Applications, Probation)

**Status:** Implemented across `packages/services` and `apps/web`, and verified against a real running Next.js server plus a real (mocked) Auth/PostgREST HTTP endpoint — see §7 for what was actually run, not just written. No new migrations were needed — Phase 7.2 builds entirely on tables and RLS policies that already existed from Phase 4 (`0004_members.sql`) and Phase 4/6's own onboarding migration (`0005_onboarding.sql`).

---

## 1. Scope (per the Development Control Rule)

Phase 7 as a whole was split into five sub-phases (see `docs/PHASE_7_1.md` §1). This document covers the second:

- 7.1 — Directory foundation: Departments, Families, Members (delivered)
- **7.2 — Onboarding: the new-member application workflow** (this deliverable)
- 7.3 — Attendance & Leave — not started
- 7.4 — Discipline (confidentiality-sensitive, standalone) — not started
- 7.5 — Events/Invitations & the generic Approvals workflow engine — not started

7.2 covers the full PRD §9.1 pipeline for a brand-new applicant: a public, sessionless `/join` flow (start an application, save progress, submit); the HR review pipeline (`submitted → pending_review → under_verification → pending_approval`); a decision (`approved`/`rejected`) with a required human-authored reason; conversion of an approved application into a real `members` row plus a `probation` record (with optional initial department/family placement, captured in the Phase 7.1 assignment-history log); and probation completion (→ active member) or failure (→ exited member, with a required reason).

Explicitly **deferred, not overlooked**:
- **Document uploads** (passport photo, national ID scan, church referral letter, certificates) — no Supabase Storage integration exists yet anywhere in this codebase. `application_documents` (0005) already has the table; there is no upload UI.
- **PDF decision letters** — PRD §43 describes AI-assisted formatting of a human-authored reason into a letter. The reason is captured and stored (`decision_reason`); rendering it as a letter is out of scope here.
- **`information_update` application type** — 0005's `applications.application_type` check constraint already allows it, and `convertApplicationToMember()` explicitly refuses to run against anything but `application_type = 'new_member'` (tested, see §7), but no `/join`-equivalent flow or review UI exists yet for an *existing* member requesting a profile update. This is a distinct, simpler workflow per PRD §8 and is left for a future phase.
- **Probation-expiry notifications** — no notification channel (email/SMS/push) is wired up anywhere in this codebase yet. `probation.deadline` is stored and indexed (`idx_probation_deadline`), ready for a future scheduled job to consume, but nothing currently reads it proactively.
- **Resending a lost access token** — by design (§2.1): there is no notification channel to resend to, so losing the application number/token means starting a new draft. The UI is blunt about this at the point the credentials are shown.

Dependencies / DB changes: **none.** `applications`, `application_documents`, and `probation` (with all their RLS policies) already existed from `0005_onboarding.sql`. This phase is entirely a service-layer + UI addition.

## 2. Architecture

```
packages/services/src/applications/   Token model, draft creation, applicant access/edit/submit, HR list/review/decide, approve→convert
packages/services/src/probation/      List/get, complete, fail
apps/web/app/join/                    Public, sessionless applicant flow (service-role client)
apps/web/app/(erp)/applications/      HR review/decision/conversion UI (RLS-scoped client)
apps/web/app/(erp)/probation/         HR probation completion/failure UI (RLS-scoped client)
```

### 2.1 The applicant's token-based access model

Applicants never get a Supabase Auth session (`ARCHITECTURE.md` §5.1) — `/join` has to work for someone who has never signed up for anything. Accordingly, `applications` has **no anon/authenticated RLS policy at all** for an applicant's own record (0005's own comment: "that path is served by a service-role Edge Function that checks the token server-side, not by client-side RLS"). Every function in `apps/web/app/join/actions.ts` therefore runs through `getSupabaseServiceRoleClient()` (bypasses RLS entirely), which makes `packages/services/src/applications/applicant-access.ts`'s `loadAndVerify()` the **entire** authorization boundary for that path — not defense-in-depth on top of RLS, the actual gate.

`loadAndVerify()` requires three things together: the application number (looked up directly, one row), the raw access token (compared as a SHA-256 hex digest via `token.ts`'s `hashToken()`/`timingSafeEqual()` against the stored `access_token_hash` — the raw token is never persisted), and the verification contact (email/phone, case-insensitive trim compare). All three failure modes — application number doesn't exist, token is wrong, contact doesn't match — return the **same generic error message**, so a caller can't use error-message differences as an oracle to enumerate valid application numbers or confirm a guessed token. The raw token is shown to the applicant **exactly once**, at draft-creation time (`StartForm`'s success panel) — there is no "resend."

### 2.2 HR-side: RLS is the real gate, not an app-layer check

Every Server Action in `apps/web/app/(erp)/applications/actions.ts` and `apps/web/app/(erp)/probation/actions.ts` uses the normal cookie-bound RLS-scoped client (`createClient()` from `@/lib/supabase/server`), the same pattern established in Phase 7.1. `applications_select_hr`/`applications_write_hr` and `probation_select_scoped`/`probation_write_hr` (0005) already gate every read/write on `members.applications.read`/`members.applications.manage` — the service functions in `packages/services/src/applications/review.ts`, `convert.ts`, and `packages/services/src/probation/complete.ts`/`fail.ts` perform no redundant permission check of their own, consistent with the "trust Postgres" pattern used throughout this codebase. The UI layer (`canManage` in `[id]/page.tsx` for both modules) only controls what *renders* — a direct POST to a Server Action from a non-privileged session would still be rejected by RLS, not silently accepted.

### 2.3 Forward-only review pipeline

`review.ts`'s `FORWARD_TRANSITIONS` table is the only thing that can move an application through `submitted → pending_review → under_verification → pending_approval → {approved, rejected}`, plus a side-branch to `incomplete` from any of the first four (HR sends it back with free-text notes; the applicant edits and resubmits via the same `submitApplication()` used for the first submission — `incomplete` is accepted alongside `draft`). There is deliberately no "jump straight to approved" and no "un-decide" — correcting a wrong decision is left as an explicit, audited follow-up action for a later phase, not a silent status edit.

### 2.4 Approval → conversion is two explicit steps, not one

`decideApplication()` (sets `approved`/`rejected` + a required human-authored `reason`) is separate from `convertApplicationToMember()` (only runs from `status === "approved"` and `application_type === "new_member"`). This models the PRD's "Approved → (Letter) → Member ID issued → Probation created" pipeline as two steps so a future letter-dispatch step has an obvious place to sit between them, and so "approved" and "actually provisioned as a member" are never conflated into one atomic action.

`convertApplicationToMember()`: creates the `members` row (via the existing Phase 7.1 `members.createMember()`), then — if a department/family was selected on the conversion form — calls `members.assignDepartment()`/`assignFamily()` immediately after, rather than passing them into `createMember()` directly. This is a deliberate workaround for a **pre-existing Phase 7.1 gap**: `createMember()` accepts `primaryDepartmentId`/`familyId` as raw insert columns with no `member_departments`/`member_families` history row. That gap was not fixed at the source in this phase (to avoid touching already-shipped, already-tested Phase 7.1 code for an unrelated phase), but the workaround here means a member converted from an application still gets a proper history-log entry for their initial placement, unlike a member created with those fields directly via `/members/new`. **This asymmetry is worth closing in a future pass** — ideally by removing the direct department/family columns from `CreateMemberInput` entirely and requiring every placement, initial or not, to go through `assignDepartment()`/`assignFamily()`.

After creating the member, it reads `system_settings.probation_duration_days` (fallback: 90 days, same "flagged placeholder" pattern as the Member ID format elsewhere in this codebase), inserts the `probation` row, and updates the application to `status: "probation"`. Like Phase 7.1's `assignDepartment()`/`assignFamily()`, this is **three-plus sequential PostgREST calls, not one Postgres transaction** (supabase-js has no raw multi-statement transaction support) — documented here and in the code, not silently assumed away.

### 2.5 Probation completion/failure

`completeProbation()` marks the probation row `completed`, promotes the member to `membershipStatus: "active"`, and — if the probation is linked to an application — closes it out as `converted_to_member`, the final state in the whole pipeline. `failProbation()` requires a non-blank `outcomeNotes` (unlike completion, where notes are optional) — the master "never silently exit someone" rule means a failure must record why — and maps to `membershipStatus: "exited"` (with `exitedAt`/`exitReason` set). **Flagged for confirmation with NGC HR:** the member lifecycle enum (`probation, active, suspended, potentially_inactive, inactive, exited`) has no dedicated "failed probation" state; `exited` is the closest faithful fit, but if HR wants failed-probation members to be distinguishable from a later voluntary/disciplinary exit, a dedicated status (or an `exit_reason` convention) would need to be added.

### 2.6 Two other interpretive decisions flagged for confirmation

- **Required-fields list** (`completeness.ts`'s `REQUIRED_FIELDS`): the PRD names the form's sections (personal, church, education, professional, choir history, musical) but not an exact mandatory-field list. This implementation requires: first/last name, gender, date of birth, phone, email, physical address, emergency contact name + phone, and current church — everything else (education entries, professional background, choir history, musical details) is optional. This mirrors the existing codebase practice of flagging placeholder `system_settings` values for confirmation rather than silently guessing.
- **JSONB search is client-side, not a JSON-path query:** `listApplications()`'s `search` option (name / application number) filters in JS after fetching by status, not via a PostgREST JSON-path filter on `submitted_data` — the hand-generated `Database` type has no relationship metadata for JSONB columns. Documented tradeoff given the expected data volume (one choir, not millions of applications), mirroring the "flat queries over embedded selects" pattern already established in Phase 6/7.1.

## 3. UI

- **Public `/join` flow** (`/join`, `/join/continue`): `/join` collects only a verification contact and issues an application number + one-time access token. `/join/continue` verifies those three credentials (calling the Server Action directly via `useTransition`, not through `useFormState` — the next step needs both the just-submitted credentials AND the action's result together, which `useFormState` alone doesn't expose), then renders the full multi-section form (or a read-only status view once the application is no longer `draft`/`incomplete`). "Save progress" and "Save & submit application" are two submit buttons in one native form — every `required` field across every section must be non-blank before *either* fires, since native HTML validation scopes to the whole `<form>`, not per-button.
- **HR `/applications` list** (`/applications`): status filter + name/application-number search, both plain GET query params.
- **HR `/applications/[id]` detail**: read-only display of every submitted section, plus — only when `canManage` — one status-appropriate action card at a time (advance to next review stage, request more information, approve/reject with a required reason, or convert to member with department/family selection once approved).
- **HR `/probation` list and `/probation/[id]` detail**: same shape as Applications — list with a status filter, detail page showing the member/dates/outcome, and (only when `canManage` and the record is `active`) "Mark completed" (notes optional) / "Mark failed" (notes required) actions.
- **Sidebar nav**: a new "Onboarding" group (Applications, Probation) was added to `apps/web/app/(erp)/layout.tsx`, visible only to users holding `members.applications.read` or `.manage` — nav visibility is a UX nicety, not the access boundary (RLS/`canManage` still gate the actual page content and actions regardless of what the sidebar shows).

## 4. A real bug found and fixed while building this phase

`apps/web/app/join/continue/continue-client.tsx`'s `ApplicationForm` binds two separate `useFormState` hooks to the same form (`saveAction` for "Save progress", `submitAction` for "Save & submit application" via `formAction` override) and needed to sync whichever one last produced a result into a single `view` state. The first version of this sync ran during render as:

```js
const latest = submitState.view ?? saveState.view ?? view;
if (submitState.view && submitState.view !== view) setView(submitState.view);
else if (saveState.view && saveState.view !== view) setView(saveState.view);
```

This is broken the moment **both** `saveState.view` and `submitState.view` are non-null and different objects — exactly what happens in the ordinary "save progress, then submit" flow. After a submit, `setView(submitState.view)` runs and `view` becomes `submitState.view`; on the next render, the `submitState.view !== view` branch is now false, but `saveState.view !== view` is now *true* (it's the earlier, stale save result — a different object reference from the current `view`), so `setView(saveState.view)` fires — which flips the comparison back the other way on the following render, forever. React caught this and threw "Too many re-renders" (React error #301), surfacing as a hard client-side crash on the submit step. This had been sitting in code that had never actually been exercised through both actions in sequence in a real browser — a direct instance of the "never claim something works without running it" risk this codebase's Development Control Rule exists to catch; it surfaced the moment `onboarding.spec.ts`'s first test tried exactly that sequence.

**Fixed** by gating each branch against its *own* last-seen ref (`lastSaveView`/`lastSubmitView`) instead of against the shared `view` state both branches mutate — each of the two action results is now synced into `view` at most once per genuinely new value, with no cross-talk between the two branches. This pattern (updating state during render, gated by a ref of the previous input) is explicitly supported by React for exactly this "derive local state from two independent async results" case, provided the gating gives each input its own independent comparison — which the original code did not.

## 5. Security review

- **No new RLS policies were needed or added** — `applications_select_hr`/`write_hr`, `probation_select_scoped`/`write_hr` (0005) were already in place. This phase's job was building a service layer and UI that trust those policies, the same discipline as Phase 7.1.
- **The token-check boundary was reviewed adversarially**, not just read for shape: confirmed `loadAndVerify()` returns the identical generic error across all three failure modes (row not found / token mismatch / contact mismatch), confirmed the token comparison is over SHA-256 hex digests (never the raw secret, never a stored plaintext token), and confirmed every applicant-facing function (`getApplicationForApplicant`, `updateApplicationDraft`, `submitApplication`) resolves to exactly one row via `loadAndVerify()` and only ever reads/writes that row — there is no code path that returns a list or another applicant's data.
- **`canManage` gating was checked for completeness, not just presence:** in `applications/[id]/page.tsx`, it gates both the action-card rendering *and* the HR-only department/family options fetch (only queried when `canManage && status === "approved"`); the same in `probation/[id]/page.tsx`. Every Server Action behind those gates relies purely on RLS (deliberately, per §2.2) — verified that RLS actually covers every table `convertApplicationToMember`/`completeProbation`/`failProbation` write to (`applications`, `members`, `member_departments`, `member_families`, `probation`), not just the top-level one.
- **Confirmed no service-role client usage anywhere under `apps/web/app/(erp)/applications/**` or `.../probation/**`** — grepped explicitly; only `apps/web/app/join/**` uses it, as designed.
- **`convertApplicationToMember()` refuses non-`new_member` applications** (`application_type !== "new_member"` throws before any write) — this is currently unreachable in production since nothing yet creates an `information_update` application (§1), but it is tested (`convert.test.ts`) as defense-in-depth for when that workflow arrives.
- **No `dangerouslySetInnerHTML` anywhere in the new code** — every piece of applicant-authored or HR-authored freeform text (outcome notes, decision reasons, incomplete-application notes) is rendered via plain JSX interpolation, which React escapes by default.
- A dedicated review pass (a separate agent, briefed adversarially against this exact checklist) independently re-verified all of the above against the actual code and found no issues.

## 6. Migrations added this phase

None. `applications`, `application_documents`, and `probation` (and all their RLS policies) already existed from `0005_onboarding.sql`.

## 7. Validation performed

- **Unit tests:** `pnpm --filter @ngc/services test` → **90/90 pass**, including the Phase 7.1 tests unaffected. New this phase: 4 create-draft, 10 applicant-access (including the generic-error-on-every-failure-mode behavior), 7 review (state-machine transitions, mark-incomplete requiring non-blank notes, decide requiring a non-blank reason), 5 convert (including the `application_type` refusal and the department/family-history workaround), 4 list, 2 probation-list, 2 probation-get, 2 complete, 2 fail.
- **Full monorepo gates:** `pnpm typecheck`, `pnpm lint`, and `pnpm build` (with placeholder env vars) all pass clean across all 8 workspace packages.
- **End-to-end (Playwright, real Next.js server + real mock Auth/PostgREST server, `apps/web/e2e/onboarding.spec.ts`, 7 tests, all passing):** an applicant starts an application, saves progress, and submits it (exercising the real `/join` → `/join/continue` flow end-to-end, including the credential-copy UI); HR reviews an application through every pipeline stage, approves it with a reason, converts it to a member with a department/family placement, and the new member and an active probation record both appear correctly in `/members` and `/probation`; HR completes a probation and the member becomes active; HR fails a probation with a required reason and the member becomes exited; HR marks an application incomplete with notes, and the applicant sees those exact notes and successfully resubmits; HR rejects an application; and a signed-in user without `members.applications.manage` sees no Applications/Probation nav entries and no write affordances on either module's detail pages, even navigating directly by URL. Combined with `auth.spec.ts` (7) and `directory.spec.ts` (8), the full suite is **22/22 passing**.
- **A real bug was found and fixed by this validation, not just by inspection** — the render-phase infinite-loop described in §4 was only caught because the e2e test actually drove the save-then-submit sequence in a real browser; it would not have surfaced from unit tests or a typecheck/lint/build pass alone.

## 8. Open issues / deferred, not overlooked

- No document/file upload UI (no Supabase Storage integration in this codebase yet) — §1.
- No PDF decision-letter generation — the human-authored reason is captured and stored; formatting it into a letter is out of scope here — §1.
- No `information_update` application workflow yet — the data model and a defensive check in `convertApplicationToMember()` are ready for it, but no `/join`-equivalent or review UI exists — §1, §5.
- No probation-expiry notifications — `probation.deadline` is stored/indexed but nothing reads it proactively yet — §1.
- The pre-existing Phase 7.1 gap where `members.createMember()`'s direct department/family columns bypass the assignment-history log is worked around in `convertApplicationToMember()`, not fixed at the source — §2.4 recommends closing it in a future pass.
- Assignment-history writes and the multi-step convert/complete/fail sequences are not atomic across their steps (same documented, non-silent limitation as Phase 7.1's `assignDepartment()`/`assignFamily()`) — §2.4, §2.5.
- Probation-failure is mapped onto the existing `membershipStatus: "exited"` state, with no dedicated "failed probation" distinction — flagged for HR confirmation, §2.5.
