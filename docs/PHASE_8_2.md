# PHASE_8_2.md — Phase 8.2 Deliverable
## Neema Gospel Choir (NGC) ERP — Operations: Uniform Management

Continuation of the Development Control Rule sequence and of Phase 8's decomposition (docs/PHASE_8_1.md's introduction). **8.2 Uniform Management** (this document) follows 8.1 (Vendors + Inventory/Assets). Remaining: 8.3 Gate Pass, 8.4 Technical Rider & Playlist, 8.5 Logistics — each pending its own separate "proceed" instruction.

## 1. Scope

In scope:
- Uniform registry (`uniforms`, PRD §7.19): list, create, edit, condition lifecycle (new/good/fair/poor/retired). Never hard-deletes a uniform — retiring keeps history intact, mirroring Assets' disposal pattern from 8.1.
- Issue/return workflow (`uniform_assignments`): issue a quantity of a uniform type to a member (optionally tied to an event — null means a standing/permanent issue), and record a return in one of three conditions — `good` (restocks `quantity_available`), `damaged` (no quantity change — there is no repair-tracking workflow in this phase), or `lost` (permanently reduces `quantity_total`, clamped at zero).
- Self-service visibility: every member can see their own outstanding and historical uniform issues on the `/uniforms` page ("My uniform issues"), via RLS rather than an application-layer grant.

Explicitly deferred, named here rather than silently skipped:
- **Repair tracking** — a `damaged` return leaves the unit out of circulation indefinitely; restocking it after repair is a manual `quantityAvailable` correction via `updateUniform` today, not a tracked workflow state.
- **A member/event picker with name search** for the issue form — `assignUniform`'s `memberId`/`eventId` are plain text fields (paste the ID from that record's own page), the same deliberate simplification as Assets' `targetId` field (docs/PHASE_8_1.md §1).
- **Gate Pass, Technical Rider & Playlist, Logistics** (8.3–8.5) — unrelated to this phase's tables, named in docs/PHASE_8_1.md's introduction.

## 2. Architecture

### 2.1 Pooled quantity, not individually-tagged items — a distinct model from Assets

Unlike Assets (8.1's individually tagged physical items with a single `availability_status` enum per row), a uniform registry entry is a **pooled count**: `quantity_total`/`quantity_available`. `assignUniform` checks `quantity_available >= quantity` rather than an equality check against one "available" state, and decrements by the issued amount rather than flipping a status flag. `returnUniformAssignment` adjusts quantities differently per return condition, as described in §1 — this three-way branch (restock / no-op / permanently reduce) has no equivalent in Assets' binary available/unavailable model and was designed fresh for this phase.

### 2.2 Retirement is unconditional and terminal, tightened relative to 8.1's disposal fix

8.1's security review found that `assignAsset`'s `override` flag could bring a **disposed** asset back into active assignment, since the availability check treated `disposed` the same as any other non-`available` status (docs/PHASE_8_1.md §2.2) — fixed there by special-casing `disposed` as unconditional. This phase applies that lesson proactively: `assignUniform` has no override flag at all, and its `condition === "retired"` check is unconditional from the start — retirement blocks issuance regardless of what `quantity_available` happens to read. `setUniformCondition` enforces the other half of the invariant by force-zeroing `quantity_available` when marking a uniform retired, so the UI's displayed count and the retirement status never visibly disagree.

This phase's own security review (§4) found one gap in that invariant that 8.1's equivalent review didn't have an analogue for: `returnUniformAssignment`'s `good` branch unconditionally restored `quantity_available`, without checking whether the uniform had since been retired. If units were outstanding at the moment of retirement and were later returned as "good," the restore would silently re-inflate `quantity_available` above zero while `condition` stayed `retired` — contradicting the "retired ⇒ 0 available" invariant shown throughout the UI (the StatusPill and the count both read from the same row), even though `assignUniform`'s own terminal check independently still blocked re-issuance. Fixed by skipping the `quantity_available` restore specifically when `returnCondition === "good"` and the uniform's current `condition === "retired"` — the return itself (and its record in assignment history) still succeeds; only the stock-count side effect is suppressed. Regression test: `assign.test.ts`'s `"returnUniformAssignment with condition=good does NOT restore quantity_available for a retired uniform"`.

### 2.3 The pooled-quantity TOCTOU race is the same accepted class as Assets', not re-litigated

`assignUniform`'s select-then-check-then-update sequence (load `quantity_available` → check → insert assignment → update quantity) has no additional locking: two concurrent issue requests could both pass the availability check before either write commits, temporarily over-issuing stock. This is the same documented, accepted low-severity race as `inventory.assignAsset`'s member/department path (docs/PHASE_8_1.md §2.3) — a stock-count discrepancy an admin corrects via `updateUniform`'s manual `quantityAvailable` field, not a privilege or authorization boundary. Not fixed here, for the same reason it wasn't fixed in 8.1: this codebase's established practice is to fix races that cross a security boundary and document races that are a data-quality nuisance.

### 2.4 Always-visible nav, verified against the actual RLS shape rather than assumed

Unlike Vendors/Assets (gated on specific permissions in 8.1, because a plain member has no legitimate self-service reason to see either), the Uniforms nav item is always visible. This mirrors Attendance & Leave's existing "always visible" treatment, and — per this phase's security review (§4) — was verified rather than assumed: `uniform_assignments_select_scoped` RLS (0012) genuinely grants every member read access to their own assignment rows (`member_id in (select id from members where user_id = auth.uid())`), the same shape as Attendance/Leave's equivalent policy (0006). Only catalog/assignment management (create, edit, condition change, issue, return) stays gated on `uniform.inventory.manage`, matching `uniforms_write_scoped`/`uniform_assignments_write_scoped` RLS, which — unlike Assets' equivalent — grants no department-leader write allowance at all.

### 2.5 `lookup_values` validation, reused from an established pattern

`createUniform`'s `uniformType` is validated against active `lookup_values(category='uniform_category')` rows before insert, mirroring `recordAttendance`'s prior security-review-driven fix for `status_code` (Phase 7.3) — the underlying column is deliberately admin-configurable free text with no FK/check constraint, so the application layer is the only place this can be caught before a garbage value reaches the row.

## 3. UI

- `/uniforms` — always visible (§2.4). Shows the registry table (type, size, available/total, condition, location) to every signed-in user, and a "My uniform issues" card to any user linked to a `members` row, listing their own outstanding/historical assignments by resolving each `uniformId` through the loaded catalog and the same `lookup_values`-backed label map used by the table (falling back to a crude label-ization only for a deactivated/missing category code). The create form is gated on `uniform.inventory.manage`, with an explicit message (not a broken link) if no active `uniform_category` lookup values exist yet.
- `/uniforms/[id]` — read access is not application-gated (`uniforms_select_internal`/`uniform_assignments_select_scoped` RLS already do the real narrowing — same "trust Postgres" pattern as the cross-module Approval Center, docs/PHASE_7_5.md). Only the edit form, the condition-change buttons, and the issue/return forms are gated on `canManage`.
- `layout.tsx` — added to the existing "Operations" nav group (Vendors, Assets, now Uniforms), with a doc comment explaining why this item, unlike its two siblings, has no `visible` gate.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation), covering: whether a non-privileged caller could bypass the UI and invoke any uniform server action directly given RLS as the real gate; whether `updateUniform`/`setUniformCondition`'s manual quantity-correction path could be used to corrupt `quantity_available`/`quantity_total` into an inconsistent state; whether `returnUniformAssignment` could double-return an assignment or act on someone else's; whether the PRD's Permission Matrix and the seed's actual grants for uniform-related roles agree; whether any member could enumerate another member's assignment history; and whether any value that should be server-derived was instead trusted from client `FormData` — found one Low-to-Medium issue (§2.2's retired-uniform restock gap), fixed and covered by a regression test, and confirmed no Critical/High findings. Specifically verified, not just assumed:

- Every write path (`createUniform`, `updateUniform`, `setUniformCondition`, `assignUniform`, `returnUniformAssignment`) is gated at the real boundary: `uniforms_write_scoped`/`uniform_assignments_write_scoped` RLS both use `for all using (has_permission('uniform.inventory.manage'))`, which Postgres applies to INSERT's implicit `WITH CHECK` too (no separate `WITH CHECK` override exists to weaken this). A non-privileged caller invoking any server action directly fails at the database layer, never silently succeeds.
- `updateUniform`'s quantity cross-validation re-checks against current DB state (not just the isolated patch), correctly rejecting negative values and `quantityAvailable > quantityTotal`.
- `returnUniformAssignment` correctly blocks double-returns via the `returned_at` guard; cross-member return abuse is foreclosed by the same permission-gated write RLS as every other write here.
- `assignedBy` is always resolved server-side from `auth.getCurrentUserWithRoles`, never from client-submitted `FormData`.
- The nav item's "always visible" claim (§2.4) was checked against the actual RLS text, not assumed by analogy.
- No PRD-vs-seed permission gap exists for Uniforms (unlike 8.1's Department Leader/Assets gap): the PRD matrix specifies only Super Admin-tier CRUD, and the seed grants `uniform.inventory.manage` accordingly — this phase does not paper over or invent anything here.
- `listUniformAssignments`/`listAssignmentsForMember` are only ever called with server-derived or route-derived IDs (the current user's own member id, or the current route's uniform id under RLS scoping) — no client-controlled id lets one member enumerate another's history.

Reviewed and explicitly not changed (documented, not overlooked):
- The pooled-quantity TOCTOU race (§2.3) — real, low-severity, documented rather than fixed, same class as 8.1's equivalent.
- The `auth.uid() is not null` SELECT RLS baseline on `uniforms` (`uniforms_select_internal`, 0012) — an inherited Phase 4 pattern, same class as the already-accepted Invitations `financial_information` limitation (docs/PHASE_7_5.md §4) and Assets' equivalent (docs/PHASE_8_1.md §4).
- No repair-tracking workflow for `damaged` returns (§1) — a manual correction today, not a gap this phase silently assumed away.

## 5. Seed data changed this phase

None. `supabase/seed/001_reference_data.sql` already had no uniform-specific gap to correct (unlike 8.1's `finance.vendors.manage` contradiction) — the only seed addition needed for the e2e suite is test-local (`lookup_values` rows for `uniform_category`, added directly in `uniforms.spec.ts`'s own `SEED_DATA`, not the shared reference-data seed).

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across every workspace package.
- 228/228 `@ngc/services` unit tests (207 pre-existing + 21 new `uniforms` module tests across `create.test.ts`, `assign.test.ts`, `update.test.ts`, `list.test.ts`, including a regression test for the security-review fix in §2.2).
- 48/48 Playwright e2e tests (45 pre-existing + 3 new `uniforms.spec.ts` tests: a Uniform Manager registering a uniform, issuing it, and recording a good-condition return; retiring a uniform zeroing its available quantity and hiding the issue form; a plain member seeing the always-visible nav link and their own issued items but no management actions).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings and resolution in §4.

## 7. Open issues / deferred, not overlooked

- No repair-tracking workflow for `damaged` returns — a manual `updateUniform` correction today (§1, §4).
- No member/event picker with name search for the issue form — plain-text ID entry today (§1).
- The pooled-quantity TOCTOU race (§2.3) — documented, not fixed; low real-world severity, same class as 8.1's equivalent.
- 8.3 (Gate Pass), 8.4 (Technical Rider & Playlist), and 8.5 (Logistics) remain, each pending its own "proceed" instruction.
