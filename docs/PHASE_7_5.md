# PHASE_7_5.md — Phase 7.5 Deliverable
## Neema Gospel Choir (NGC) ERP — Events/Invitations & Approvals

Continuation of the Development Control Rule sequence (Phase 4 Database, Phase 5 Design System, Phase 6 Authentication, Phase 7.1 Directory, Phase 7.2 Onboarding, Phase 7.3 Attendance & Leave, Phase 7.4 Discipline). This phase closes out the rest of Phase 7 per the roadmap: the Invitation/Event Management module (PRD §7.8, §7.24, §9.2) and the generic, cross-module Approval Workflow Engine + Management Approval Center (ARCHITECTURE.md §12, PRD §7.29/§9.5).

## 1. Scope (per the Development Control Rule)

In scope:
- Public, token-based invitation submission (`/invite`) and organizer status-check/resubmit (`/invite/status`) — the same authorization model as Onboarding's `/join` (a signed, hashed access token + a secondary verification contact, checked entirely at the application layer since `invitations` has no anon-role RLS policy at all).
- Internal invitation review: `submitted → received → under_review`, a `pending_information` request/resubmit loop, and starting the configured approval chain.
- The generic workflow engine (`workflow_definitions`/`workflow_instances`/`workflow_step_decisions`, all from Phase 4's 0019 migration) wired up to a real caller for the first time: approve/reject/request-changes decisions, sequential multi-step advancement, and a cross-module **Approval Center** (`/approvals`) — the "one UI, reused across every approvable record type" ARCHITECTURE.md §12 describes.
- On full approval, automatic creation of the `events` row (0008's schema) linked to the invitation.
- A generic polymorphic `comments` module (`packages/services/src/comments`) — the first real caller of the `comments` table from 0018, used for the internal review thread and organizer-visible notes.
- A minimal, read-mostly `/events` module: list and detail, enough to see what an approved invitation produced.

Explicitly deferred (named here rather than silently skipped, matching every prior phase's practice):
- **Technical Rider & Playlist** (PRD §7.9) and **Gate Pass** (§7.6) — both depend on the Technical/Inventory modules, not yet built.
- **Logistics Itinerary** (§7.25) — depends on the Logistics/Vendors module.
- **Member Event Eligibility** (§7.11) and **Member Event Attendance** (§7.26) — depend on the eligibility-scoring engine and the department/technical/musical-requirements data model, both future phases.
- **Structured `event_requirements` rows** (distinct from the organizer's free-text fields on `invitations` — see 0008's own doc comment) — its primary consumer is Technical Rider generation, which isn't built yet; populating it now would be a stub with no reader.
- **Expenses/Gate Passes/Applications/Procurement on the generic workflow engine** — Applications' approval today is still its own ad hoc `review.ts` logic (Phase 7.2), predating this engine. Retrofitting it is a deliberate, separate decision for a later phase, not a silent scope-creep here.
- **Calendar publication and department notifications** on approval (PRD §9.2's "published to internal Calendar... departments notified") — no notification/calendar engine exists yet (both are explicitly Phase 2/backlog per the PRD's phasing).
- **Conditional (non-mandatory) step skipping** — `workflow_definition_steps.is_mandatory` exists in the schema but this phase's engine always advances sequentially through every step; there is no evaluation rule in the PRD for how a non-mandatory step would be auto-skipped, so nothing invents one.

## 2. Architecture

### 2.1 A real, pre-existing authorization gap found while wiring up the engine for the first time

The seeded default Invitation approval chain (001_reference_data.sql) is Secretary → Technical Manager → Finance Manager → Chairman. But `workflow_instances_write_service` RLS (0019, Phase 4) requires `management.approvals.manage` to advance a `workflow_instances` row — and per that same seed data, Technical Manager and Finance Manager hold only `management.approvals.read_all`, never `.manage`. As written, the two roles the PRD explicitly names as approvers could see their pending step but had no RLS-legal way to act on it. **Migration 0028** fixes this the same way Discipline's 0026 fixed its own analogous gap: a narrow, purpose-built `record_workflow_decision` SECURITY DEFINER function that re-verifies the caller actually matches the *current step's* `required_role_code`/`required_user_id` — never accepting `management.approvals.manage` as a stand-in for "is the right approver," since that permission governs Approval-Center visibility and administrative oversight, not step impersonation. The pre-existing `workflow_step_decisions_insert_approver` policy (which checked only `approver_id = auth.uid()`, satisfiable by anyone) is tightened to require the same match, closing a direct-insert bypass too.

### 2.2 The workflow engine stays decoupled from module side effects, on purpose

`packages/services/src/workflow` knows nothing about invitations, events, or calendars — it only starts instances, records decisions, and reports what's pending. `packages/services/src/invitations/approval.ts` is the composition layer: it calls the generic engine, reads back the resulting instance status, and reacts (`approved` → invitation status + `createEventFromInvitation()`; `rejected` → `declined`; `request_changes` → `pending_information` + an organizer-visible comment). This is exactly the split ARCHITECTURE.md §12 calls for, and it means a future Expense Request or Gate Pass module can reuse the same engine with its own equally small reaction file, not a fork of the engine itself.

### 2.3 `request_changes` resumes the same step, and `startInvitationApproval` knows how to resume

A `request_changes` decision does **not** create a new workflow instance or restart the chain at step 1 — the same `workflow_instances` row stays `pending` at the *same* `current_step_order`. Once the organizer resubmits and HR walks the invitation back through `received`/`under_review`, `startInvitationApproval()` checks for an existing instance first and, if found, only updates the invitation's status — it does not (and, per 0019's `unique (record_type, record_id)`, cannot) create a second one. The same approver who requested changes reviews the fix, not a fresh chain from the top.

### 2.4 A security review found and fixed a real gap in this phase's own new code, not just Phase 4's

An adversarial review after the initial build found that the Approval Center page's "is this pending step mine?" check looked only at `required_role_code`, never `required_user_id` — a legal, schema-supported step shape (0019 allows a step to name a specific user instead of a role) that this omission would have silently hidden from its assigned approver. Fails closed (no privilege escalation), but breaks the feature for that step shape. Fixed by centralizing the check in one function (`workflow.isCurrentStepFor()`) used by every call site, instead of three independent, driftable copies — with a unit test asserting the user-specific case explicitly.

## 3. UI

- `/invite` — public submission form; shows the invitation number + access token exactly once, same "save this now" pattern as `/join`.
- `/invite/status` — verify by invitation number + access code + verification contact; shows organizer-visible comments; a resubmit form appears only when `pending_information`.
- `/invitations`, `/invitations/[id]` — internal list/detail, gated on `events.invitations.read`/`.manage` (a narrower, PRD-Permission-Matrix-driven gate than the underlying RLS's broader "any signed-in user" baseline — see §5). The detail page shows the approval chain's decision history, an inline decision form to whoever the current step belongs to, and the internal/organizer-visible comment thread.
- `/events`, `/events/[id]` — minimal read views.
- `/approvals` — the cross-module Approval Center; today exclusively populated by Invitations, built generically per-record-type so a future module drops in without a page rewrite.
- `middleware.ts` — `/invite` added to `PUBLIC_PREFIXES` (a real bug caught immediately by the first e2e run: without it, every public-facing invitation page redirected an anonymous organizer straight to `/login`).

## 4. Security review

Three items were found and fixed in this pass (not just flagged):

1. **The Phase 4 `workflow_instances`/`workflow_step_decisions` RLS gap** described in §2.1 — fixed by 0028's `record_workflow_decision` function and the tightened insert policy.
2. **The Approval Center's role-only step-match check** described in §2.4 — fixed by centralizing the check and covering the missed shape with a unit test.
3. **The `/invite` middleware gap** described in §3 — fixed by adding it to `PUBLIC_PREFIXES`.

Reviewed and explicitly ruled out (not just assumed fine):
- Whether the TS-layer approver pre-check in `workflow/record-decision.ts` could be fooled by a malicious caller into approving a decision it shouldn't — confirmed harmless either way, since the caller-supplied `actingUserId`/`actingUserRoleCodes` are only used for a friendlier client-side error message; `record_workflow_decision` derives the real approver from `auth.uid()` inside the database and re-verifies unconditionally.
- Whether the public resubmit flow lets an organizer smuggle in `status`, `access_token_hash`, or `verification_contact` changes — confirmed no: the update is built from a fixed whitelist of `InvitationFormData` fields; those three columns are never sourced from the caller's patch.
- Whether `createEventFromInvitation()`'s idempotency check has a race that could double-create an event — confirmed the actual serialization point is `record_workflow_decision`'s `select ... for update` row lock on the workflow instance; a losing concurrent caller re-reads `status <> 'pending'` and errors out before ever reaching the event insert, and `events.invitation_id` is unique regardless.

Known, deliberately accepted limitation (documented, not silently ignored): `invitations_select_internal`/`events_select_internal` RLS (0008, Phase 4) is `auth.uid() is not null` — any signed-in staff member can read every invitation's fields, including `financial_information`, not just Finance/Secretary. This is an intentional "internal transparency" baseline this schema already applied consistently across the whole Events/Invitations domain before this phase touched it (compare `event_requirements`, `event_participants`), not a gap this phase introduced. This phase's internal UI narrows *who sees the module at all* to the PRD's named roles (`events.invitations.read`/`.manage`) as an application-layer convenience, but does not add column-level masking of `financial_information` at the database layer. Flagged as a future hardening candidate, not claimed as solved.

## 5. Migrations added this phase

- **0028_workflow_decision_function.sql** — `record_workflow_decision` SECURITY DEFINER function (the only write path for advancing a `workflow_instances` row); tightened `workflow_step_decisions_insert_approver` RLS policy. No new tables — everything else needed (`invitations`, `events`, `workflow_definitions`/`workflow_instances`/`workflow_step_decisions`, `comments`) already existed from Phase 4.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across every workspace package.
- 183/183 `@ngc/services` unit tests (including the new `comments`, `workflow`, `events`, and `invitations` modules, and a dedicated regression test for the §2.4 fix).
- 41/41 Playwright e2e tests (37 pre-existing + 4 new `invitations.spec.ts` tests: full happy-path submission → review → two-role approval chain → event creation; the pending-information/resubmit loop; a rejection path; and permission gating for a plain member).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) covering the new RPC's authorization boundary, the anti-enumeration token design, idempotency/race behavior, and the resume-after-`request_changes` logic — findings and resolutions in §4.

## 7. Open issues / deferred, not overlooked

- No column-level masking of `financial_information` from non-Finance internal roles (§4's "known, deliberately accepted limitation").
- No calendar publication or department notification on approval (no notification engine yet).
- No structured `event_requirements` breakdown (organizer's free-text fields on `invitations` stand in for now).
- Conditional/non-mandatory workflow steps are schema-ready (`is_mandatory`) but not evaluated — every seeded step is mandatory today, so this has no current effect, but a future config screen offering a "make this step optional" toggle would need real skip logic added here first.
- Applications (Phase 7.2) still uses its own bespoke approval logic, not this engine — a deliberate non-retrofit, not an oversight.
