# PHASE_9_2.md — Phase 9.2 Deliverable
## Neema Gospel Choir (NGC) ERP — Finance: Expenses / Petty Cash

Continuation of the Development Control Rule sequence and of Phase 9's decomposition (docs/PHASE_9_1.md's introduction). **9.2 Expenses/Petty Cash** (this document) follows 9.1 (Contributions) and precedes 9.3 (Procurement, which depends on this phase's expense requests).

## 1. Scope

In scope:
- **Expense requests** (`expense_requests`, PRD §7.16): create (any member, for themselves), draft-only editing, a configurable organization ID (`EXP-{year}-{sequence}` via `next_formatted_id()`, matching every other formatted ID in this schema), and the full lifecycle — draft → pending approval → approved/rejected → paid → closed.
- **The approval chain** (finance_manager → secretary → chairman, seeded "Standard Expense Approval" `workflow_definition`, matching PRD §7.16/§6's "Chairman/Secretary/Finance Manager, order configurable"): submitting a draft into the chain, and each step's approver deciding it, reusing the existing generic `record_workflow_decision` (0028) — no changes needed there.
- **A new, narrowly-scoped migration**: `start_expense_request_workflow` (0031), a SECURITY DEFINER RPC — the fourth instance of this codebase's established "narrow, purpose-built escape hatch" pattern (after `apply_disciplinary_membership_status` 0026, `record_workflow_decision` 0028, `start_gate_pass_workflow` 0029). See §2.1.
- **Lifecycle actions**: `markExpensePaid` (approved → paid, with a payment reference) and `closeExpenseRequest` (paid → closed, terminal).
- **Expense categories**: admin-configurable `lookup_values` (category='expense_category'), matching Uniforms'/Discipline's own category-list convention.
- **`supportingDocumentId`**: a plain paste-the-id field, wired up end-to-end for the first time in this codebase (§2.4).

Explicitly deferred to their own later sub-phase or out of scope, named here rather than silently skipped:
- **Procurement** — 9.3, not part of this document; depends on this phase's approved expense requests.
- **A member/department/event/document picker with name search** — plain paste-the-id text fields today, the same established simplification as every prior Phase 8/9.1 module.
- **A dedicated `finance.expenses.read` permission for HR** — PRD §6 gives HR "Create, Read" on Expenses, implying read access to every request, not just their own. No such permission code exists in the seed at all (only `.manage` and `.approve` do). Closing this properly means inventing a brand-new permission code, a larger change than the pure seed-data grant corrections made in 9.1/Phase 8.1 — left as a named open item (§7) rather than invented here.

## 2. Architecture

### 2.1 `start_expense_request_workflow` (0031) — the same escape-hatch pattern as Gate Pass, with two deliberate differences

`workflow_instances_write_service` (0019) requires `management.approvals.manage` to insert a `workflow_instances` row — a permission an ordinary requester (the only person who may submit their OWN expense request, per `expense_requests_insert_self` RLS) does not hold. This is the identical shape of gap `start_gate_pass_workflow` (0029) already solved, extended a third time (after Discipline's 0026). Two differences from 0029, both deliberate:

1. **Authorization is `requested_by = auth.uid()` (self-submission), not a `has_permission(...)` check.** Gate Pass's RPC checks `inventory.gate_passes.manage` because a gate pass is itself a permission-gated management record. An expense request is a genuine self-service record any member may create and submit — this matches `expense_requests_insert_self`'s own shape exactly.
2. **It also performs the `expense_requests.status = 'draft' → 'pending_approval'` transition itself, atomically, in the same transaction.** Gate passes have no separate `'draft'` state to leave (they're created already `pending_approval`); expense requests genuinely do, and PRD §7.16 describes "Draft → Submitted → Pending Approval" as real states a request passes through. See §2.2 for why "Submitted" itself is never persisted.

Every bare column reference in 0031 is qualified with a table alias (`er.id`, not `id`) from the first draft — the 0028→0030 discovery (plpgsql's `variable_conflict = error` treats an unqualified column matching this function's own RETURNS TABLE OUT parameter names as ambiguous) is applied pre-emptively here, not rediscovered a third time.

**A real bug found and fixed by this phase's security review**: the authorization check was originally written as `v_expense_request.requested_by <> auth.uid()`. Plain `<>` evaluates to SQL NULL — neither true nor false — whenever `auth.uid()` itself is NULL, and plpgsql's `if` treats a NULL condition as false, silently **skipping** the check rather than failing it. Verified directly against a live local Postgres instance: with `app.current_user_id` unset (simulating a null `auth.uid()`), the RPC succeeded and started the workflow for a draft belonging to a different user entirely. Fixed by using `is distinct from` instead of `<>`, which treats NULL as a real, comparable value — re-verified against the same live instance to confirm the call now correctly raises.

### 2.2 "Submitted" is never persisted as its own database state — a deliberate simplification

`expense_requests.status`'s check constraint (0014) literally includes both `'submitted'` and `'pending_approval'` as distinct values. This phase's service layer (`submitExpenseRequestForApproval`, workflow.ts) never sets `'submitted'` — "submit for approval" is treated as ONE atomic transition straight from `'draft'` to `'pending_approval'`. Nothing in PRD §7.16's text describes a distinct action or behavior that happens only at "Submitted" before "Pending Approval" follows it (unlike, say, Invitations' own internal-review stage, which genuinely is separately actionable). `'submitted'` remains in the type and the database constraint for forward compatibility only.

### 2.3 A real Postgres manual-verification pass, matching the technique that caught Phase 8.3's genuine production bug

The full 3-step chain was walked directly against a live local Postgres instance via `psql` (not just unit/e2e tests, which use a fake client/mock server respectively, neither of which executes real SQL function bodies): a self-submission attempt by a non-owner correctly raised; the legitimate owner's submission atomically flipped `expense_requests.status` to `pending_approval` and created a `pending` `workflow_instances` row at step 1; a second submission attempt correctly raised (the draft-only guard fires before the duplicate-instance guard would even be reached); and `record_workflow_decision` walked finance_manager → secretary → chairman to a final `approved` workflow status. This is the same practice Phase 8.3 used to catch a genuine, already-shipped production bug in `record_workflow_decision`'s column qualification — this phase's own new RPC was written qualification-correct from the start (§2.1), and this manual pass is what caught the `<>`/NULL bug in §2.1 instead.

### 2.4 `supportingDocumentId` is wired up end-to-end — the first module to actually do so

Both `leave_requests.supporting_document_id` (Phase 7.3) and `expense_requests.supporting_document_id` (Phase 4/9.2) are nullable FK columns to `documents` (0015), a module with no service layer or UI built by any phase yet. Leave's equivalent field was silently never given a form field at all — not even documented as deferred. This phase does not repeat that silent omission: `ExpenseForm` includes a plain paste-the-id `supportingDocumentId` field (the same established cross-module-reference simplification as every other id field in this codebase), and `types.ts`'s own doc comment names this as the first module to actually use this kind of field.

## 3. UI

- `/expenses` — **always visible** in the nav (Finance group, alongside Contributions), the same "everyone has a real reason to be here" shape as Attendance & Leave: `expense_requests_insert_self`/`_select_scoped` RLS (0014) let any signed-in user create and read their OWN requests. A "My expense requests" section mirrors Contributions'/Uniforms' own self-service sections. The full cross-member list is additionally shown to anyone holding `finance.expenses.manage` **or** `.approve` — not `.manage` alone, since an approver who isn't also a manager (Secretary, Chairman) still needs visibility into every request awaiting a decision, the same either-or reasoning as Contributions' `.manage`/`.read` gate.
- `/expenses/[id]` — no explicit read-permission branch (unlike Gate Passes' detail page): `expense_requests_select_scoped` RLS already returns nothing for an unauthorized caller, so `getExpenseRequest` naturally returns `null` and the page 404s, the identical pattern Leave's own detail page already relies on. Editing is shown only to the owner while still a draft; the approval chain, decision form (shown only to whoever the current step names, mirroring Gate Pass's `isCurrentStepFor` gate exactly), mark-paid, and close actions are gated in-page on `finance.expenses.manage`/ownership/current-approver-status as appropriate.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covered the new migration (0031), the full service layer, UI/actions, the new nav item, the e2e spec and mock RPC handler, and the actual RLS policies in 0014/0019, explicitly checking whether the same class of bug found in 9.1 (trusting caller-supplied status instead of re-reading the database) recurred here. Findings and resolution:

- **Medium — `start_expense_request_workflow`'s self-submission check used `<>` instead of `is distinct from`, silently passing when `auth.uid()` was NULL** (§2.1). **Fixed** — verified both the failure and the fix directly against a live local Postgres instance.
- **High (pre-existing, whole-schema pattern, not introduced by this phase) — any holder of `finance.expenses.manage`/`.approve` can PATCH `expense_requests` directly via the generic REST endpoint with no restriction tying the write to the current workflow step**, letting a single approver bypass the finance_manager→secretary→chairman chain entirely (e.g. jump straight to `approved`/`paid`) with no `workflow_instances`/`workflow_step_decisions` audit trail. Confirmed this is not unique to Expenses: `gate_passes_write_scoped` RLS (0011) has the identical shape — `inventory.gate_passes.manage` alone permits a direct write to any column, including `status`, bypassing Gate Pass's own 2-step chain the same way. This is a standing design property of every `_manage`-gated table in this schema (RLS grants the whole row to a permission holder; the workflow engine's segregation-of-duties guarantee is enforced by the service layer's own use of `record_workflow_decision`, not by RLS itself preventing a direct write). **Left undone, not overlooked** — properly closing this needs either a schema-level redesign (RLS predicated on the caller actually being the current workflow step's approver, or revoking direct status-column UPDATE and routing every lifecycle transition through a SECURITY DEFINER RPC) applied consistently across every workflow-backed table in the schema, well beyond this phase's "build a service+UI layer on existing schema" scope. Named here as a real, standing gap for whoever next revisits the workflow engine's RLS design (§7).
- The review separately confirmed: `updateExpenseRequest`'s draft-only guard and `markExpensePaid`/`closeExpenseRequest`'s status guards all re-read the authoritative row from the database themselves (the 9.1-class bug does NOT recur here — written correctly from the first draft, not fixed after the fact); `record_workflow_decision` genuinely re-verifies the caller against the CURRENT step's role/user match regardless of what the app layer passes, so the chain cannot be decided out of order, twice, or by the wrong role; the "always visible" nav reasoning is correctly backed by RLS; the e2e mock's RPC handler omission (not re-checking `requested_by`) matches the established, documented "mock exercises mechanics, real SQL exercises auth" convention with no additional undocumented gap; and no raw SQL string interpolation exists anywhere in the reviewed files.

## 5. Seed data changed this phase

None. `finance.expenses.manage`/`.approve` and their grants to `finance_manager` (and the workflow chain's `secretary`/`chairman` role assignments) were already present in `supabase/seed/001_reference_data.sql` since Phase 4, unused by any real caller until this phase.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across every workspace package.
- 313/313 `@ngc/services` unit tests (296 pre-existing + 17 new: 3 `expenses/create.test.ts`, 4 `expenses/update.test.ts`, 6 `expenses/workflow.test.ts`, 4 `expenses/lifecycle.test.ts`).
- 57/57 Playwright e2e tests (55 pre-existing + 2 new `expenses.spec.ts` tests: the full draft → edit → submit → 3-step approval → paid → closed lifecycle across four distinct signed-in actors, and a plain member confirmed to see only their own requests with no cross-member list or decision UI).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings and resolution in §4, with the Medium finding fixed and re-verified against real Postgres before this phase was considered complete.
- **Manual `psql` verification of 0031 against a live local Postgres instance** (not just unit/e2e coverage, neither of which executes real SQL function bodies) — self-submission-by-a-non-owner correctly refused (both before and after the NULL-auth fix, with the NULL-auth bypass specifically reproduced and then confirmed fixed), a legitimate owner's submission atomically transitioning `expense_requests.status` and creating the workflow instance, a duplicate-submission attempt correctly refused, and the full finance_manager → secretary → chairman chain walked to `approved` via `record_workflow_decision`.

## 7. Open issues / deferred, not overlooked

- No member/department/event/document picker with name search — plain-text ID entry today (§1), matching every prior module's identical deferral.
- **No `finance.expenses.read` permission exists for HR's PRD-named "Create, Read" entitlement** (§1) — closing this needs a new permission code, not a pure seed-data grant correction; left as a named gap rather than invented here.
- **Any `finance.expenses.manage`/`.approve` holder can bypass the approval chain entirely via a direct REST write to `expense_requests`, with no RLS tying the write to the current workflow step** (§4) — a real, pre-existing, whole-schema design pattern (identically true of Gate Pass's own 2-step chain since Phase 8.3), not unique to or introduced by this phase, and not something this phase's "build on existing schema" scope can properly fix without a broader workflow-engine RLS redesign. Named here for whoever next revisits it.

Phase 9.2 (Expenses/Petty Cash) is complete. Per the Development Control Rule, Phase 9.3 (Procurement) requires its own explicit "proceed" instruction — though per the same continuation authorization already given for Phase 8's sub-phases and 9.1, work continues directly into it next.
