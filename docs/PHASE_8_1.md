# PHASE_8_1.md — Phase 8.1 Deliverable
## Neema Gospel Choir (NGC) ERP — Operations: Vendors registry + Inventory/Asset Management

Continuation of the Development Control Rule sequence. Phase 8 ("Operations") per `ARCHITECTURE.md §19`'s roadmap covers Technical Rider/Playlist, Inventory/Assets, Gate Pass, Uniform, Logistics, and Vendors — six sub-domains, the same scale as Phase 7's five sub-phases. This phase is decomposed the same way Phase 7 was (7.1–7.5): **8.1 Vendors registry + Inventory/Asset Management** (this document), followed by 8.2 Uniform, 8.3 Gate Pass, 8.4 Technical Rider & Playlist, and 8.5 Logistics — each pending a separate "proceed" instruction per the Development Control Rule. 8.1 comes first because Gate Pass, Technical Rider, and Logistics all reference Assets and/or Vendors; building those registries first avoids stub foreign keys.

## 1. Scope

In scope:
- Vendor registry (`vendor_categories`/`vendors`, PRD §7.15): list, create, edit, status lifecycle (active/inactive/blacklisted). Never hard-deletes a vendor — blacklisting keeps history intact.
- **Column-level financial masking**, implemented for the first time in this phase: `vendors.tax_information`/`bank_payment_information` are visible only to callers holding `finance.vendors.manage`, per 0013's own column comment ("Logistics sees vendor contact but not banking details") — a design directive that existed in the schema since Phase 4 but had no service layer to enforce it until now.
- Inventory/Asset Management (`asset_categories`/`assets`/`asset_assignments`, PRD §7.5): list/filter by category and availability, create (auto-generated asset tag via the same `next_formatted_id()` convention every other formatted ID in this schema uses), edit, assign to a member/department/event, record a return (good/damaged/lost, each restoring `availability_status` appropriately), and dispose (a terminal state — the row is never deleted, only every future assignment is blocked).

Explicitly deferred to their own later sub-phases, named here rather than silently skipped:
- **Gate Pass** (§7.6) — depends on Assets (this phase) and the workflow engine (Phase 7.5); the automatic gate-pass-from-equipment-assignment flow is 8.3.
- **Technical Rider & Playlist** (§7.9) — depends on Assets (this phase) and an approved Invitation/Event (Phase 7.5); 8.4.
- **Uniform Management** (§7.19) — independent of this phase's tables but not built yet; 8.2.
- **Logistics/Trips/Itineraries** (§7.7, §7.25) — depends on Vendors (this phase); 8.5.
- **A member/department/event picker with name search** for the assignment target field — `assignAsset`'s `targetId` is a plain text field today (paste the ID from that record's own page); a proper cross-module search-and-select control is a UX improvement, not an authorization gap, and is deferred rather than silently assumed unnecessary.
- **Quantity-aware partial returns** — `asset_assignments.quantity`/`status = 'partially_returned'` exist in the schema (for a future bulk-consumable use case) but this phase's `returnAssignment()` always closes the assignment fully; nothing today creates a multi-quantity assignment that would need partial return.

## 2. Architecture

### 2.1 Financial-field masking is an application-layer projection, not a database-layer one — and a real seed-data bug undermined it until this phase's own security review caught it

`vendors_select_internal` RLS (0013) is `auth.uid() is not null` — the same internal-transparency RLS baseline already accepted for Invitations/Events (docs/PHASE_7_5.md §4) and Assets (§2.2 below). Masking of `tax_information`/`bank_payment_information` therefore happens entirely in `packages/services/src/vendors/map.ts`: `mapVendorRow(row, includeFinancial)` nulls both fields unless the caller explicitly passes `includeFinancial: true`, and every page derives that flag from the signed-in user's real `finance.vendors.manage` permission, resolved server-side — never from client input.

An adversarial security review of this phase found that this masking was a no-op for the exact role it was built to protect against: `supabase/seed/001_reference_data.sql`'s original Phase 4 seed granted `logistics_officer` **both** `logistics.vendors.manage` and `finance.vendors.manage`, directly contradicting 0013's own column comment. Since the seed data lives in this same active-development repository (not a shipped production system) and the contradiction is between the seed and its own migration file's stated intent — not an invented new policy — the grant was corrected to remove `finance.vendors.manage` from `logistics_officer`. Logistics still fully manages the vendor registry via `logistics.vendors.manage` alone (RLS grants either permission full row access); only the financial-field visibility distinction changes, matching what the column comment always said it should be.

The masking remains, and is documented as, a UI-layer convenience: any authenticated user with direct API/database access (bypassing this app's service layer entirely) can still read the real columns, exactly like the accepted `financial_information` limitation on Invitations (docs/PHASE_7_5.md §4). This phase does not add row- or column-level RLS for it — flagged as a future hardening candidate in §4/§7, not claimed as solved.

`updateVendor`/`setVendorStatus` mask their own return values the same way: the response includes real financial fields only when that specific call actually patched one of them (the caller who just typed a new value obviously already knows it), never as a blanket echo — a security-review fix, since the original version always echoed real values regardless of what was patched, a latent leak for any future caller that uses the return value.

### 2.2 Disposal is terminal, enforced in the service layer, not just the UI

A security review found that `assignAsset`'s `override` flag (meant for PRD §7.6's "blocks double-booking absent explicit override") could also be used to bring a **disposed** asset back into active assignment, since the availability check treated `disposed` the same as any other non-`available` status. Fixed by special-casing `disposed` as unconditional: no override can assign a disposed asset. Disposal is documented as permanent (0010: "preserving assignment/return/damage history"); this closes the one path that contradicted that.

### 2.3 The event double-booking backstop is the database; the member/department check is the application layer, with a known, accepted race

`uq_asset_assignments_no_concurrent_event_booking` (0010) is a partial unique index — the hard, race-safe backstop for the PRD's explicitly named case (assigning equipment to an event). `assignAsset` catches its 23505 violation with a friendly message rather than a generic error. For member/department targets, which that index does not cover, the availability check is select-then-check-then-insert with no additional locking — a real, low-severity TOCTOU race under concurrent requests (two callers could both pass the check before either insert commits). Flagged rather than fixed in this phase: the realistic harm is a confusing double-assigned physical item, not a privilege escalation, and this codebase's established pattern (see Phase 7.5's `createEventFromInvitation` idempotency discussion) is to fix races where the harm is a security boundary and document races where it's a data-quality nuisance.

## 3. UI

- `/vendors`, `/vendors/[id]` — gated on `logistics.vendors.manage`/`finance.vendors.manage`; the create/edit form itself omits the tax/bank fields entirely for a caller without `finance.vendors.manage`, rather than rendering them blank (so a Logistics Officer's edit can never accidentally null out Finance-recorded banking data — see `updateVendorAction`'s doc comment).
- `/assets`, `/assets/[id]` — gated on `inventory.assets.manage`/`inventory.categories.manage`/`technical.equipment.assign`; category/availability filters via GET query params (same pattern as Probation/Members); assignment and return forms gated on `inventory.assets.manage`/`technical.equipment.assign` (mirroring `asset_assignments_write_inventory` RLS exactly).
- `layout.tsx` — new "Operations" nav group (Vendors, Assets), each item's visibility resolved from the same permission codes the pages themselves check.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covering financial-field masking, write authorization, assignment races, disposal/override abuse, and nav/page permission-gate consistency found two Medium-severity issues, both fixed in this pass (§2.1, §2.2), and confirmed no Critical/High findings — no cross-role privilege escalation was introduced by this phase's new code.

Reviewed and explicitly not changed (documented, not overlooked):
- The `auth.uid() is not null` SELECT RLS baseline on `vendors`/`assets`/`asset_categories`/`asset_assignments` (0010, 0013) — an inherited Phase 4 pattern, same class as the already-accepted Invitations `financial_information` limitation (docs/PHASE_7_5.md §4), not something this phase made worse.
- The member/department assignment race (§2.3) — real, low-severity, documented rather than fixed.
- `assignAsset`'s `targetId` has no referential-integrity check against `members`/`departments`/`events` — matches the schema's deliberately FK-less polymorphic design (0010, Phase 4); a typo'd id creates an orphaned assignment row with no error rather than a security bypass.

**A real gap this phase does NOT fix, flagged instead**: the PRD Permission Matrix (§6) names Department Leader as having "Read" access to Inventory/Assets and Finance Manager as having "Read (value)" — neither role holds any `inventory.*` permission in the current seed (only Inventory Officer and Technical Manager do). This phase's nav/page gates therefore under-serve those two roles relative to the PRD rather than inventing a permission grant nobody has asked for. A future phase (or a direct instruction) should add the missing permission code(s) and grants once confirmed with NGC leadership which fields "Read (value)" is meant to expose to Finance specifically.

## 5. Seed data changed this phase

No new migration — the schema (0009–0013) already existed from Phase 4. Two changes to `supabase/seed/001_reference_data.sql`:
- Added `id_format.asset_tag` (`"AST-{year}-{sequence}"`) — the one formatted-ID setting Phase 4's seed hadn't added yet, needed by `createAsset()`'s `next_formatted_id()` call.
- Removed `finance.vendors.manage` from `logistics_officer`'s grant (§2.1) — a correction, not a new policy invention.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across every workspace package.
- 207/207 `@ngc/services` unit tests (including new `vendors` and `inventory` modules, and regression tests for both security-review fixes).
- 46/46 Playwright e2e tests (42 pre-existing + 4 new `inventory-vendors.spec.ts` tests: Logistics/Finance financial-field masking end-to-end, an asset's full assign→return lifecycle, disposal, and permission gating for a plain member).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings and resolutions in §4.

## 7. Open issues / deferred, not overlooked

- Financial-field masking is application-layer only (§2.1) — no column-level RLS/masking at the database layer, same class of limitation already accepted for Invitations.
- The member/department assignment TOCTOU race (§2.3) — documented, not fixed; low real-world severity.
- Department Leader's and Finance Manager's PRD-specified read access to Inventory/Assets has no matching permission grant (§4) — flagged for a future decision, not invented here.
- No member/department/event picker with name search for assignment targets — plain-text ID entry today (§1).
- Quantity-aware partial returns are schema-ready but unused (§1).
- 8.2 (Uniform), 8.3 (Gate Pass), 8.4 (Technical Rider & Playlist), and 8.5 (Logistics) remain, each pending its own "proceed" instruction.
