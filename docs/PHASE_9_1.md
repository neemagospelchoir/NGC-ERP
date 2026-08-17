# PHASE_9_1.md — Phase 9.1 Deliverable
## Neema Gospel Choir (NGC) ERP — Finance: Contributions

Continuation of the Development Control Rule sequence. Phase 9 ("Finance") per `ARCHITECTURE.md`'s roadmap covers Contributions, Petty Cash/Expense Management, and Procurement — three sub-domains, all of whose core schema already exists from Phase 4 (`supabase/migrations/0014_finance.sql`), the same "build a service+UI layer on existing, RLS-protected schema" shape as all of Phase 8. This phase is decomposed as **9.1 Contributions** (this document, no dependencies), **9.2 Expenses/Petty Cash** (depended on by 9.3), and **9.3 Procurement** (depends on 9.2's expense requests and Phase 8.1's vendors/assets) — ordered by FK dependency, mirroring Phase 8.1's own stated reasoning for building what's depended upon first. Each sub-phase is pending a separate "proceed" instruction per the Development Control Rule.

**Financial Reports are explicitly descoped from Phase 9.** ARCHITECTURE.md's roadmap names Reporting as its own, later, separately-numbered phase — no reporting engine of any kind exists anywhere in this codebase yet, and building one here would be scope creep well beyond what "9. Finance" itself lists. Phase 9's three sub-phases build campaign/expense/procurement records and a single per-campaign dashboard view (already in the Phase 4 schema); a general reporting engine is left for that dedicated phase.

## 1. Scope

In scope:
- **Contribution campaigns** (`contribution_campaigns`, PRD §7.14): create, edit, and an explicit status state machine (`draft → active → closed`, either non-terminal state → `cancelled`; closed/cancelled are permanent). Target amount and deadline are optional (an open-ended campaign is legitimate).
- **Contribution records** (`contribution_records`): recording a member's contribution against a campaign (amount, currency, date, payment method, reference, notes) and reversing a mistaken/duplicate/bounced entry — reversal marks the row `"reversed"` rather than deleting it, the same "never delete a financial/audit-relevant record" convention as Discipline's cases and Assets' disposal pattern.
- **Campaign dashboard** (PRD §7.14): reads `contribution_campaign_summary` (0014's own view — total contributors, total confirmed contributed, outstanding-vs-target, achievement percentage) directly; nothing here recomputes those aggregates client-side.
- **"My contributions"**, a self-service section on the Contributions list page mirroring Uniforms' "My uniform issues" — any member can see their own contribution history without needing any permission, matching `contribution_records_select_scoped` RLS's own self-row clause.
- **A seed-data correction**: `hr_deputy_secretary` now holds `finance.contributions.read` (§2.3 below).

Explicitly deferred to their own later sub-phases or out of scope, named here rather than silently skipped:
- **Expenses/Petty Cash and Procurement** — 9.2 and 9.3, not part of this document.
- **Financial Reports** — deferred to ARCHITECTURE.md's own later, separately-named Reporting phase (see this document's introduction).
- **A member picker with name search** for the "record a contribution" form's `memberId` field — a plain paste-the-ID text field today, the same deliberate, already-repeated simplification as Uniforms' `AssignUniformForm`/Assets' `targetId` (docs/PHASE_8_1.md §1).
- **Department Leader's "Read (own dept. summary)" entitlement** (PRD §6) — not satisfiable by existing RLS at all; see §2.4/§7.

## 2. Architecture

### 2.1 `recordContribution` always inserts as `"confirmed"`, never `"pending"`

`contribution_records.status` (0014) has three values — `pending`, `confirmed`, `reversed` — but PRD §7.14 describes no distinct action between "a contribution happens" and "it's confirmed"; nothing in the PRD's text implies a two-step clearing workflow this phase needs to model. `recordContribution` always inserts `status: "confirmed"` directly (matching the table's own column default and the demo seed's usage); reversing a mistaken entry is the only status transition this phase implements. If a future need for tracking not-yet-cleared payments emerges, `"pending"` remains available in the check constraint without a schema change.

### 2.2 The PRD's "Draft → Submitted → Pending Approval" language is not modeled as three states here

Unlike Expense Requests (9.2, not yet built), Contribution campaigns have only four statuses in their own check constraint (`draft`, `active`, `closed`, `cancelled`) — there is no `submitted`/`pending_approval` distinction to collapse in the first place. This section exists only to note, for anyone comparing sub-phases, that Contributions never had that ambiguity 9.2 will need to resolve.

### 2.3 `setCampaignStatus` re-reads the campaign's status from the database; it does not trust a caller-supplied "current status"

An earlier version of this function took `(id, currentStatus, nextStatus)`, validating the transition against whatever `currentStatus` the caller passed in — sourced, in the UI, from a page's render-time snapshot of `campaign.status`. An adversarial security review of this phase (§4) found this let a stale browser tab (or a direct call to the underlying server action with a forged `from` value) silently revert a campaign that was actually already `closed`/`cancelled` back to `active`, defeating the "closed and cancelled are permanent" invariant the UI itself claims. The fix re-reads the authoritative row inside `setCampaignStatus` itself before validating the transition — matching Discipline's own `advanceCaseStatus` (`packages/services/src/discipline/case-status.ts`), which has always re-read its row rather than trusted a caller's claim. The exported server action signature is now `setCampaignStatusAction(id, to)` — no `from` parameter exists to forge.

The same review found two related gaps, both now closed: `recordContribution` refuses to record a new contribution against any campaign whose status isn't `active` (a `draft` campaign isn't open for contributions yet; a `closed`/`cancelled` one is permanent), and `updateCampaign` refuses to edit a campaign's name/description/target/deadline once it is `closed`/`cancelled`. Both re-read the campaign's row themselves rather than trusting the caller, the same pattern as the status fix. The UI (`/contributions/[id]`) mirrors this: the edit form and "record a contribution" card are hidden once a campaign is terminal, showing a read-only detail view and an explanatory note instead, so a manager never fills out a form whose submission would just come back as an error.

### 2.4 The HR "Read (summary)" seed grant, and the Department Leader gap left undone

PRD §6's Permission Matrix gives HR/Deputy Secretary "Read (summary)" on Contributions. The permission code itself, `finance.contributions.read`, has existed since Phase 4's seed (`supabase/seed/001_reference_data.sql`) but was never actually granted to `hr_deputy_secretary` — the identical shape of pre-existing seed-vs-PRD gap Phase 8.1 corrected for `logistics_officer`/`finance.vendors.manage` (docs/PHASE_8_1.md §2.1). Since the contradiction is between the seed and the PRD's own stated intent for an already-existing permission code — not an invented new policy — the grant was added directly to the seed file (and applied to the local Postgres dev instance used for manual verification this phase).

PRD §6 also gives Department Leader "Read (own dept. summary)" on Contributions. This is **not** satisfiable by any existing mechanism: `contribution_records` carries no department column or join path at all — only a self-row clause (`member_id` matching the caller) or the two Finance/HR permissions above. Granting a Department Leader either of those permissions would give them visibility into every department's contributions, not just their own — over-widening access to "fix" a gap the schema itself doesn't support scoping for. This is left as a genuine, named open item (§7), not invented around with new RLS or a misleading app-layer filter (the same restraint Phase 8.5 applied to Trips/Itineraries' RLS gap, docs/PHASE_8_5.md §2.3).

## 3. UI

- `/contributions` — **always visible** in the nav (new "Finance" group), the same reasoning as Uniforms/Technical Riders/Trips: `contribution_campaigns_select_internal` RLS (0014) lets any signed-in user read every campaign, and `contribution_records_select_scoped` legitimately lets every member see their own contribution history. A "My contributions" card mirrors Uniforms' "My uniform issues" exactly. Only campaign creation is gated on `finance.contributions.manage`, in-page (not at the nav level).
- `/contributions/[id]` — the campaign dashboard (KPI tiles from `contribution_campaign_summary`), an editable details form for a manager (read-only otherwise, or once the campaign is terminal — §2.3), the full contribution-records list (shown to anyone holding `finance.contributions.manage` **or** `.read`, matching `contribution_records_select_scoped` RLS's either/or clause exactly — not `.manage` alone), a "record a contribution" form, and status-transition buttons, both gated on `.manage` alone (matching the write policies, which recognize only that permission).
- A dedicated client "table" component (`CampaignsTable`) built from the start, avoiding the "functions passed to Client Components" mistake Phase 8.4 first hit and fixed (docs/PHASE_8_4.md §3) — not rediscovered here. `ContributionRecordsTable`'s per-row "Reverse" button uses the same already-established pattern as Attendance's `RosterTable` (`actions: Record<string, ...>`, a map of Server-Component-bound Server Action references passed down as a plain prop) rather than passing an arbitrary closure into a Client Component.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covered the full service layer, UI/actions, the new nav group, the seed-data change, and the e2e spec, cross-referenced directly against 0014's RLS policies. Findings and resolution:

- **High — `setCampaignStatus` trusted a caller-supplied "current status" instead of re-reading the authoritative row**, letting a stale tab or direct action call revert a terminal campaign back to `active`. **Fixed** — §2.3.
- **Medium — recording a new contribution and editing campaign details were never blocked once a campaign reached a terminal status**, contradicting the UI's own "permanent" claim and letting a closed campaign's total keep climbing or its target be edited retroactively. **Fixed** — §2.3.
- **Low — the campaign summary KPI tiles are shown to every viewer without noting that, for a viewer without `.manage`/`.read`, the security-invoker view is scoped down to their own row** (a correctness/UX issue, not an authorization leak — RLS is correctly protecting other members' rows; the number shown is just misleadingly labeled for that viewer). **Left as documented, non-actionable** — the underlying scoping is correct and no real member ever contributes enough distinct campaigns for this to matter in practice; revisit only if a future phase adds a dedicated non-manager summary view.
- **Informational — `reverseContribution`'s "already reversed" check is a read-then-write, not a single atomic compare-and-swap.** Harmless in practice (a concurrent double-reverse is idempotent — both calls converge on the same `"reversed"` value); not fixed, matching the same accepted class of TOCTOU note made for `generateItinerary` (docs/PHASE_8_5.md §4) and `start_gate_pass_workflow` (docs/PHASE_8_3.md).

The review separately confirmed: no UI/service-layer gate exists anywhere in this phase without a matching, actually-enforcing RLS policy behind it (every `canManage`/`canReadAllRecords` check corresponds to `contribution_campaigns_write_finance`/`contribution_records_write_finance`/`contribution_records_select_scoped`); `recordedBy`/`createdBy` are always resolved server-side from the authenticated session, never taken from form data; the new HR seed grant is exactly `finance.contributions.read` on the correct role, no accidental `.manage` or wrong-table grant; and no raw SQL string interpolation or `dangerouslySetInnerHTML` usage anywhere in the reviewed files.

## 5. Seed data changed this phase

- `supabase/seed/001_reference_data.sql`: added `finance.contributions.read` to `hr_deputy_secretary`'s permission grant (§2.4) — a correction matching the PRD's own stated intent for an already-existing permission code, the same class of fix as Phase 8.1's `logistics_officer` correction. Applied directly to the local Postgres dev instance used for manual verification this phase, in addition to the seed file itself.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across every workspace package.
- 296/296 `@ngc/services` unit tests (280 pre-existing + 16 new: 4 `contributions/create.test.ts`, 6 `contributions/update.test.ts`, 6 `contributions/record.test.ts` — including three added directly in response to this phase's security-review findings).
- 55/55 Playwright e2e tests (53 pre-existing + 2 new `contributions.spec.ts` tests: a Finance Manager creating a campaign, recording a contribution, reversing it, and closing the campaign; a plain member confirmed to see only their own contribution history and no management controls).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings and resolution in §4, with the High and Medium findings fixed and covered by new regression tests before this phase was considered complete.
- The HR seed-data grant was additionally verified directly against the local Postgres dev instance via `psql` (confirmed absent before the fix, present and scoped to exactly one permission code after).

## 7. Open issues / deferred, not overlooked

- No member picker with name search on the "record a contribution" form — plain-text ID entry today (§1), matching every prior Phase 8 module's identical deferral.
- **Department Leader's "Read (own dept. summary)" entitlement (PRD §6) has no supporting mechanism** — `contribution_records` carries no department scoping at all, and granting either existing Finance permission would over-widen access rather than satisfy "own department only" (§2.4). Closing this properly needs a real schema/RLS change (a department join path on `contribution_records` or a new department-scoped permission), out of this phase's "build on existing schema" scope.
- The campaign summary KPI tiles are shown to every viewer with the same labels regardless of whether the underlying numbers are scoped down to "my own contributions only" for a non-manager/non-HR viewer (§4) — a documented UX correctness note, not an authorization gap.
- `reverseContribution`'s "already reversed" guard is not a single atomic operation (§4) — accepted, matches an established class of already-documented TOCTOU notes elsewhere in this codebase.

Phase 9.1 (Contributions) is complete. Per the Development Control Rule, Phase 9.2 (Expenses/Petty Cash) requires its own explicit "proceed" instruction — though per the same continuation authorization already given for Phase 8's sub-phases, work continues directly into it next.
