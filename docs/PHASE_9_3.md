# PHASE_9_3.md — Phase 9.3 Deliverable
## Neema Gospel Choir (NGC) ERP — Finance: Procurement

Continuation of the Development Control Rule sequence and of Phase 9's decomposition (docs/PHASE_9_1.md's introduction). **9.3 Procurement** (this document) follows 9.2 (Expenses/Petty Cash), on whose already-approved expense requests this sub-phase entirely depends, and completes Phase 9 (Finance).

## 1. Scope

In scope:
- **Procurement requests** (`procurement_requests`, PRD §7.17): started only from an already-`approved` `expense_requests` row, then walked through `pending → vendor_selected → purchased` (or `cancelled` from either of the first two states).
- **Vendor selection** (`selectVendor`): records the chosen vendor and moves `pending → vendor_selected`.
- **Purchase recording** (`recordPurchase`): creates a `purchase_orders` row and moves the parent request `vendor_selected → purchased`.
- **Payment recording** (`recordPayment`): records `unpaid → partially_paid → paid` against a purchase order.
- **Inventory record creation** (`createAssetForPurchaseOrder`): PRD §7.17's "Inventory update" step, for purchases that turn out to be assets — reuses Phase 8.1's own `inventory.createAsset` directly (§2.3).
- **Cancellation** (`cancelProcurementRequest`): terminal, refused once a request has already been purchased.

Explicitly deferred to their own later sub-phase or out of scope, named here rather than silently skipped:
- **Financial Reports** — descoped from all of Phase 9 to a later, separately-named Reporting phase (stated at Phase 9's outset, repeated here for this sub-phase's own record).
- **A member/vendor/expense picker with full name-search/autocomplete** — see §2.2 for why this module partially departs from the plain paste-the-id convention rather than fully adopting it.
- **A `finance.procurement.approve` permission or a procurement-specific approval chain** — deliberately not introduced; see §2.1.

## 2. Architecture

### 2.1 No `workflow_definitions` row for Procurement — implicitly pre-approved via the parent expense request

Every other approval-driven module in this codebase (Gate Pass, Discipline, Expenses) has its own seeded `workflow_definitions`/`workflow_definition_steps` rows and its own `start_*_workflow` RPC. Procurement deliberately has **none of this**. PRD §7.17 describes the flow as a single, already-linear chain hanging off an expense request that has *already* cleared its own approval: "Approved expense → Procurement → Vendor → Purchase → Payment → Inventory update." There is no PRD-named second sign-off gate between "expense approved" and "procurement started" — the expense request's own three-step chain (finance_manager → secretary → chairman, 9.2) is the only approval this money ever needs. Treating Procurement as a second, separately-approved record would invent a control PRD §7.17 never describes.

Concretely, this means:
- `createProcurementRequest` (create.ts) re-reads the parent `expense_requests.status` itself from the database (never trusting a caller-supplied assumption, the established Phase 9 pattern — see docs/PHASE_9_1.md §2.3/docs/PHASE_9_2.md §2.1) and refuses to create a procurement request against anything but an `'approved'` expense request. This re-check IS Procurement's entire authorization gate against "was this spending actually approved" — there is no second one.
- No procurement UI or service file calls `workflow.getWorkflowForRecord`/`listWorkflowDecisions`, and none should — no instance is ever created for `record_type = 'procurement_request'`, so calling those would only ever return nothing.
- `procurement_requests`/`purchase_orders`' own RLS (0014) is a flat `finance.procurement.manage`-gated write, not a workflow-scoped one — there is no current-step concept to scope against, unlike `expense_requests_update_scoped`/`gate_passes_write_scoped`.

### 2.2 Vendor selection uses a real `<Select>`, not a paste-the-id field — a deliberate, narrow departure from the established convention

Every prior Phase 8/9 cross-module reference (Expenses' `departmentId`/`eventId`/`supportingDocumentId`, Gate Pass's `Event ID`/`Asset ID`, etc.) is a plain paste-the-id text field — the established simplification for a codebase with no built member/department/event picker UI. Procurement's `vendorId` field (both at request-creation time, optionally, and definitely at vendor-selection time) and its create-form's `expenseRequestId` field instead use real `<Select>`s populated from `vendors.listVendors()` and `expenses.listExpenseRequests(client, { status: "approved" })` respectively.

This is deliberate, not an oversight, for two reasons specific to Procurement and not shared by the self-service modules the paste-the-id convention was designed for:
1. **Procurement's entire audience is Finance staff** (`finance.procurement.manage`/`.expenses.manage` holders only — §3), unlike Expenses/Contributions, which are self-service modules any member touches. A narrow, small, internal audience justifies a small UI convenience a mass-audience module wouldn't.
2. **Both enumerations are cheap and already bounded by an existing service function** — `listVendors()` and `listExpenseRequests({ status: "approved" })` are pre-existing, already-used reads, not new queries invented to justify this departure. Neither list is expected to grow large enough to need pagination or search-as-you-type in this org's real usage (a choir's vendor list and its currently-approved-but-not-yet-procured expense requests are both realistically small, single-digit-to-low-double-digit sets at any one time).

Every other id-shaped field in this module (`categoryId` for asset creation) also uses a `<Select>` for the identical reason (`inventory.listAssetCategories()` is cheap and this module's audience is the same narrow Finance-only one) — not a blanket policy change for the rest of the codebase, just this module's own narrow audience justifying it consistently within itself.

### 2.3 `createAssetForPurchaseOrder` reuses `inventory.createAsset` directly — the same reuse-not-reimplement pattern Gate Pass established

Mirrors Gate Pass's (8.3) reuse of `inventory.assignAsset` rather than reimplementing equipment assignment: `procurement/asset.ts` imports `createAsset` from `../inventory/create` and calls it directly, then links the result back via `purchase_orders.created_asset_id`. This is manual and explicit (a Finance/Procurement user deliberately triggers it once, for a purchase that turns out to be an asset) rather than auto-detecting "is this an asset" from the purchase description — PRD §7.17 says "automatically create OR SUGGEST an inventory record," and "explicitly triggered by the person who just recorded the purchase" satisfies "suggest" without inventing category-guessing heuristics no other module in this codebase has. Refuses to run twice for the same purchase order by re-reading `created_asset_id` first (a purchase order maps to at most one created asset, matching the column being a single nullable FK, not a list).

An independent adversarial security review (§4) confirmed this reuse does not bypass any Inventory-phase invariant: the `assets` table's own RLS write policy (`assets_write_inventory`, requires `inventory.assets.manage`) still applies to the insert regardless of which module's code path triggered it.

### 2.4 `recordPayment` intentionally allows more than one call per purchase order — unlike `markExpensePaid`'s one-shot terminal transition

`payment_status` is a three-value enum (`unpaid` / `partially_paid` / `paid`), not a boolean, because PRD §7.17's "Payment" step genuinely supports incremental partial payments before a purchase is fully settled. `recordPayment` therefore does not add an idempotency guard refusing a second call the way `markExpensePaid`/`closeExpenseRequest` (9.2) refuse to re-run a true one-shot terminal transition — doing so would block the legitimate `unpaid → partially_paid → paid` progression PRD §7.17 itself describes. It does still re-read `purchased_at` and refuse to record any payment before a purchase actually exists.

## 3. UI

- `/procurement` — **gated**, not always-visible, unlike Contributions/Expenses (which have a genuine self-service angle) and matching Vendors/Gate Passes/Assets' own nav treatment instead: Procurement has no self-service reader at all (PRD §7.17's flow runs entirely inside Finance once an expense request is already approved). Read is gated on `finance.procurement.manage` **or** `finance.expenses.manage` (an approver who isn't also a procurement manager still needs visibility into what Procurement is doing with requests they approved, the same either-or reasoning as every other Finance module's read gate this phase); write (the create form, and every detail-page action) is gated on `finance.procurement.manage` alone, matching `procurement_requests_write_finance`/`purchase_orders_write_finance` RLS exactly.
- `/procurement/[id]` — unlike Expenses'/Leave's detail pages (which rely on RLS-returns-null-so-404), this page has its own explicit "you don't have permission" branch, the same shape as Gate Pass's detail page — because, like Gate Pass, Procurement has no self-service reader RLS clause to fall back on. Vendor selection, purchase recording, payment recording, and inventory-record creation are each shown only once the request's own current status makes that action valid (§2.1's status machine), and only to a `finance.procurement.manage` holder.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covered the full service layer, UI/actions, the new nav item, the e2e spec, and the actual RLS policies in 0014, explicitly checking whether the "trusting caller-supplied status instead of re-reading the database" bug class (found in 9.1, fixed pre-emptively in 9.2) recurred here, whether reusing `inventory.createAsset` could bypass any Inventory-phase invariant, and whether the read/write RLS-gate shape was correctly mirrored by the UI. Findings:

- **No new bugs found.** Every write function (`createProcurementRequest`, `selectVendor`, `recordPurchase`, `recordPayment`, `createAssetForPurchaseOrder`, `cancelProcurementRequest`) re-reads its own row's authoritative status/relevant column from the database before acting, confirmed by both the reviewer's reading of the code and this phase's own passing unit tests. The RLS read/write gate shape (read: `finance.procurement.manage` OR `finance.expenses.manage`; write: `finance.procurement.manage` alone) is correctly mirrored by the UI's permission checks in `page.tsx`/`[id]/page.tsx`/`layout.tsx`, with no case of read gated too narrowly or write gated too broadly.
- **`createAssetForPurchaseOrder`'s reuse of `inventory.createAsset` does not bypass any Inventory-phase invariant** — the `assets` table's own RLS write policy still applies to the insert regardless of which module's code triggered it, and asset-tag generation still goes through the same shared `next_formatted_id()` path as every other asset creation.
- **High (pre-existing, whole-schema pattern, not introduced by this phase) — any holder of `finance.procurement.manage` can PATCH `procurement_requests`/`purchase_orders` directly via the generic REST endpoint**, bypassing the status machine described in §2.1 entirely (e.g. jumping a request straight to `purchased` with no vendor ever selected). This is the identical shape already documented as an open item in docs/PHASE_9_2.md §4 for Expenses and confirmed identical in Gate Pass (8.3) before that — a standing property of every `_manage`-gated table in this schema, not unique to or newly introduced by Procurement. Left undone for the same reason: properly closing it needs a schema-level redesign applied consistently across every state-machine-backed table, well beyond this phase's "build a service+UI layer on existing schema" scope.
- **Informational, not action-required**: `recordPayment` has no guard refusing a second call on an already-`'paid'` purchase order — deliberate, not an oversight, since `payment_status`'s `partially_paid` value means more than one legitimate call per purchase order is expected (§2.4). The reviewer also noted a narrow TOCTOU window in `recordPurchase`'s two-step write (insert `purchase_orders`, then update the parent's status) — if the second write fails and the same request is retried, a second `purchase_orders` row could be inserted before the parent's status re-read would reject it. This is the same general "accepted non-atomicity" shape already documented for `decideExpenseRequestApproval` (9.2), and since the acting user already holds full write permission on the affected rows regardless (per the point directly above), it grants no capability beyond what is already accepted. Not fixed, for the same reason 9.2's own non-atomicity note wasn't: a genuinely atomic fix needs a database transaction or unique constraint this phase's scope doesn't call for.

## 5. Seed data changed this phase

None. `finance.procurement.manage` and its grant to `finance_manager` were already present in `supabase/seed/001_reference_data.sql` since Phase 4, unused by any real caller until this phase.

## 6. Validation performed

- `pnpm --filter @ngc/services typecheck` / `pnpm --filter @ngc/web typecheck` / `pnpm --filter @ngc/web lint` / `pnpm --filter @ngc/web build` all clean.
- 331/331 `@ngc/services` unit tests (313 pre-existing + 18 new: 2 `procurement/create.test.ts`, 4 `procurement/vendor.test.ts`, 4 `procurement/purchase.test.ts`, 2 `procurement/payment.test.ts`, 2 `procurement/asset.test.ts`, 4 `procurement/cancel.test.ts`).
- 59/59 Playwright e2e tests (57 pre-existing + 2 new `procurement.spec.ts` tests: the full start-from-an-approved-expense → select vendor → record purchase → record payment → create inventory record lifecycle, and a plain member confirmed to have no Procurement nav link and to be denied direct access to `/procurement`).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings in §4; no new bug required a fix before this phase was considered complete.

## 7. Open issues / deferred, not overlooked

- No vendor/expense-request name-search/autocomplete beyond the plain `<Select>`s described in §2.2 — acceptable today given this module's small, Finance-only audience and small enumerable lists; would need revisiting if either list grows large.
- **Any `finance.procurement.manage` holder can bypass Procurement's own status machine entirely via a direct REST write** (§4) — a real, pre-existing, whole-schema design pattern (identically true of Expenses' and Gate Pass's own chains since 9.2/8.3), not unique to or introduced by this phase, and not something this phase's "build on existing schema" scope can properly fix without a broader RLS redesign applied consistently everywhere it recurs. Named here for whoever next revisits it, alongside the identical items already named in docs/PHASE_9_2.md §7 and Gate Pass's own equivalent.
- A narrow TOCTOU window in `recordPurchase`'s two-step write (§4) — the same accepted non-atomicity class as `decideExpenseRequestApproval` (9.2), not fixed for the same reason.

Phase 9.3 (Procurement) is complete, and with it, **Phase 9 (Finance) in full** (9.1 Contributions, 9.2 Expenses/Petty Cash, 9.3 Procurement). Per the Development Control Rule, Phase 10 requires its own explicit "proceed" instruction — no further phase begins until then.
