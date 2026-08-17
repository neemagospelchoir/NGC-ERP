# PHASE_13_2.md — Phase 13.2 Deliverable
## Neema Gospel Choir (NGC) ERP — Reporting: The Remaining Eleven PRD §11 Report Subjects

Phase 13.1 built the reporting engine and shipped PRD §15's MVP tier (Member, Attendance, Invitation). 13.2, continuing under the same Phase 13 authorization, extends the engine to the full PRD §11 list: Contribution, Expense, Vendor, Inventory/Asset, Event, Logistics, Technical, Uniform, Discipline, HR, and Management — fourteen report subjects in total. No new engine work was needed; §2.1 explains why extending coverage was mostly a matter of adding period-filtering to existing list functions and writing eleven more thin report definitions, not building anything new.

## 1. Scope

In scope:
- **Eleven new report definitions** (`packages/services/src/reports/definitions/{contributions,expenses,vendors,assets,events,logistics,technical,uniforms,discipline,hr,management}.ts`), each composing an existing or newly period-extended, already-RLS-scoped service function — the same "compose, don't add a new raw query" discipline 13.1 established for Member/Attendance/Invitation.
- **Additive `createdFrom`/`createdTo` (or module-specific equivalent) period filters** on nine existing list functions: `contributions` (new `listContributionsInPeriod`), `expenses.listExpenseRequests`, `vendors.listVendors`, `inventory.listAssets`, `trips.listTrips`, `technical-riders.listTechnicalRiders`, `uniforms` (new `listUniformAssignmentsInPeriod`), `discipline.listCases`, `leave.listLeaveRequests` — every one an optional parameter on an unchanged query, exactly mirroring 13.1's own `joinedFrom`/`joinedTo` precedent on `listMembers`.
- **One new cross-cutting list function**, `workflow.listWorkflowInstances`, alongside a refactor extracting the pre-existing `listMyPendingApprovals`'s row-hydration logic into a shared `hydrateInstances()` helper so the two functions can't drift.
- **A UI-layer permission gate for the Discipline Report** — the one report of the fourteen that is genuinely confidential (§2.2) — in both `(erp)/reports/page.tsx` (hides it from the picker, refuses to run it) and `(erp)/reports/export/route.ts` (refuses to export it), each independently checking `discipline.cases.read`/`.manage`.
- **An extended `REPORT_FILTER_SUPPORT` matrix** in `page.tsx` covering all fourteen report keys' status-filter option lists, plus six new/extended `status.ts` helper files (`contributions`, `expenses`, `vendors`, `assets`, `events`, `approvals`) supplying the option arrays that didn't already exist.
- **Explicit, documented scoping decisions** for every ambiguous report subject (§2.3) — each recorded in its own definition file's doc comment, the same "volume dimension" precedent 13.1's Invitation Report set.

Explicitly deferred, named here rather than silently skipped:
- **Management KPI dashboards** — still PRD §15's own separately-named V2 feature, not a checkbox on this list. The Management Report is a filterable list of `workflow_instances`, not a chart or a computed approval-rate.
- **A report on individual asset assignment/return activity** — the Asset Report's `status` filter is `AssetAvailabilityStatus` (a snapshot property of the asset itself), not a per-assignment record; that would need `listAssetAssignments`/`listAssignmentsForTarget` composed into a different report, not built here.
- **Logistics coverage of Itineraries** — scoped to Trips only (§2.3).
- **Resolving `expenses.requestedBy` to a member display name** — no existing bulk-resolve-by-`users.id` function exists, and building one is judged out of scope for this report's first cut (see `expenses.ts`'s own doc comment).

## 2. Architecture

### 2.1 Why this sub-phase needed almost no new engine work

13.1 built the hard part — the period resolver, the `ReportResult` contract, the registry, the CSV exporter, and the Excel/PDF renderers — precisely so that adding report #4 through #14 would be mechanical: resolve a period, call an existing (or trivially extended) list function, map its rows onto a fixed column set. That held. The only genuinely new service-layer work this phase did was add optional date-range parameters to nine list functions (all additive, all backward-compatible — verified for `listTechnicalRiders` specifically, since its signature changed from zero-arg to an optional-options-arg, by grepping for its one existing caller before making the change) and extract/add the workflow-instance-listing pair described below. No new migration, no new RLS policy, no new permission — every one of the eleven new reports inherits an RLS policy that already existed before this phase touched it.

### 2.2 Which reports need UI-layer permission-gating beyond RLS — and why only one

13.1 already established that RLS is the real authorization boundary for Reports; the question this phase had to answer directly, rather than assume, was: does any of the eleven new report subjects' underlying RLS actually restrict who can see it, the way Discipline's does? Direct inspection of each relevant policy (not assumption) found three distinct shapes:

- **Fully open ("RLS is the real boundary")**: `invitations_select_internal`, `assets_select_internal`, `vendors_select_internal`, `technical_riders_select_internal`, `trips_select_internal`, `events_select_internal` — all `auth.uid() is not null`, i.e. any signed-in user. Several of these modules' own *nav* items are permission-gated in `(erp)/layout.tsx` purely for PRD-staff-matrix UX convenience (e.g. Vendors, Assets), but that gating is orthogonal to what the underlying data actually permits — exactly 13.1's own precedent with Invitations, whose nav is gated but whose report is not.
- **Genuinely RLS-restrictive but not S33-confidential**: `workflow_instances_select_scoped` narrows results to `management.approvals.read_all` holders or the current step's matching role/user — real scoping, but not "hidden even from the person it concerns" the way Discipline is. The Management Report inherits this unchanged; a caller who only ever matched one step sees only instances still sitting at that step, same as the Approval Center already shows them.
- **Genuinely confidential (spec S33)**: `disciplinary_cases_select_discipline_only` restricts every row to `discipline.cases.read`/`.manage` holders — not even the member a case concerns can see it. This is the one case where relying on RLS alone to make a resulting empty report "self-explanatory" was judged insufficient, matching `discipline/page.tsx`'s own existing in-page guard for the live module. The Discipline Report picker option and the report/export routes now perform the identical explicit check.

Contribution and Uniform assignment activity are RLS-scoped to "your own, or your department's, or an explicit manage permission" (`contribution_records_select_scoped`, `uniform_assignments_select_scoped`) — narrower than "any signed-in user" but not confidential in the S33 sense; a plain member running either report simply sees their own activity, the same as the live Contributions/Uniforms pages already show them, so no extra UI gate was added for either.

Net result: of the fourteen reports, **only Discipline** gets an explicit UI-layer permission check. Every other report (including the nav-gated-for-UX-only Vendor/Asset/Event reports) stays always-visible in the picker.

### 2.3 Scoping decisions for ambiguous report subjects

PRD §11 names each report subject in a word or two; several needed a judgment call about exactly which existing data they cover, each recorded in the corresponding definition file's own doc comment:

- **Vendor Report** — registered-in-period, with `includeFinancial: false` hard-coded regardless of the caller's real `finance.vendors.manage` permission. A downloaded report file leaves the on-screen session (forwarded, printed, archived); tax/bank information has no legitimate reason to ride along in an operational "which vendors did we register" report even for an authorized Finance viewer, who already has that detail on the vendor's own page.
- **Asset/Inventory Report** — registered-in-period; `status` means `AssetAvailabilityStatus` (available/assigned/under_maintenance/missing/disposed), the asset's own snapshot status, not a per-assignment record.
- **Logistics Report** — Trips only, not Itineraries (a generated document derived from a trip, not a second countable record).
- **Technical Report** — Technical Riders only; the schema has no equipment-line-items table to report on (see `technical-riders/types.ts`'s own doc comment).
- **Uniform Report** — issuance *activity* (`uniform_assignments` in period), not the static catalog — the same "records/requests in a period" shape as Contribution/Expense/Discipline, and the more informative reading: the catalog's own `quantityAvailable` already answers "what's in stock right now" on the live Uniforms page, which has no period dimension worth filtering.
- **HR Report** — Leave Requests only, not Applications/Probation (already substantially covered by the Member Report's own period-filtered "who joined this window" view).
- **Management Report** — `workflow_instances` of any status within a period, explicitly not a KPI/analytics dashboard (§1).
- **Expense Report** — does not resolve `requestedBy` to a display name (§1).

### 2.4 The `workflow` refactor

`packages/services/src/workflow/list-pending.ts`'s pre-existing `listMyPendingApprovals` inlined its own row-hydration (resolving each instance's workflow-definition name and current-step role/user). Adding `listWorkflowInstances` for the Management Report by copy-pasting that logic would have created two copies that could silently drift. Instead, the hydration logic was extracted into a private `hydrateInstances()` helper, and both functions now call it — `listMyPendingApprovals`'s own query (`status = 'pending'`, ascending) is completely unchanged, only refactored to route through the shared helper; `listWorkflowInstances` adds its own `status`/`createdFrom`/`createdTo`-filtered query on top of the same `workflow_instances_select_scoped` RLS. This was checked closely during review specifically because a refactor, unlike a pure addition, can introduce a subtle behavior change — confirmed it does not.

## 3. UI

- `(erp)/reports/page.tsx` — the report picker now lists fourteen options (thirteen for a caller without `discipline.cases.read`/`.manage` — the Discipline option is filtered out of the list `reports.listReportDefinitions()` returns before it reaches the `<Select>`). The status-filter dropdown is now driven by a `StatusFilterKind` → options-array lookup (`STATUS_OPTIONS_BY_KIND`) instead of two hard-coded branches, so adding a fifteenth report's status filter in the future is one matrix entry, not a new conditional block.
- `(erp)/reports/export/route.ts` — an explicit `reportKey === "discipline"` check refuses the export with `403` before `runReport` is ever called, independent of (and matching) the page's own check.
- Six `status.ts` files gained or received a `*_OPTIONS` export for the Reports page's dropdown: `expenses/status.ts` and `events/status.ts` (already had label/tone maps, just needed the `Object.entries(...)` options export added, matching `discipline/status.ts`'s/`leave/status.ts`'s existing pattern exactly); `vendors/status.ts`, `assets/status.ts`, `contributions/status.ts`, and `approvals/status.ts` are new files, each deliberately leaving any pre-existing local tone map in that module's own table component untouched — these new files exist solely to give the Reports page a reusable options array, not to refactor those components' on-screen pill rendering.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covered five areas: the Discipline Report's permission gate (both `page.tsx` and `export/route.ts`, checked against the actual `disciplinary_cases_select_discipline_only` migration SQL, not assumed); the Vendor Report's financial-field masking under every input including a caller with real `finance.vendors.manage`; the RLS-scoping claims of all nine extended list functions plus the `workflow` refactor specifically (on the theory that a refactor is more likely than a pure addition to introduce a subtle behavior change); CSV formula-injection and filename/header-injection risk across the eleven new report definitions; and whether the page's and the export route's independent Discipline checks could disagree in a way an attacker could exploit by using whichever was weaker.

No exploitable defects were found. Specific findings:

- The Discipline gate's `reportKey` is validated against a hardcoded string-literal union before either permission check runs, so there is no case-sensitivity or alternate-encoding path around it; the underlying RLS policy is exactly as restrictive as claimed (verified against migration 0007's actual SQL); both `page.tsx` and `export/route.ts` check the identical two permission codes with identical OR logic — neither is weaker than the other.
- `runVendorsReport` hard-codes `includeFinancial: false` and its own column list never references the financial fields at all, so there is no input that makes them appear in `ReportResult.rows`, independent of what `listVendors`/`mapVendorRow` would do for a caller who genuinely could see them elsewhere.
- All nine extended list functions add only `.gte()`/`.lte()` to their existing query builder chain, on the same client instance already passed in — no new or more-privileged Supabase client, no raw SQL, no widening of any pre-existing `.eq()` filter. The `workflow` refactor's extracted `hydrateInstances()` is not exported (confirmed via `workflow/index.ts`) and both callers still run through the unchanged `workflow_instances_select_scoped` policy.
- Every one of the fourteen report definitions (old three and new eleven alike) returns a generic `ReportResult` that flows through the one shared `toCsv` — there is no per-report CSV code path to bypass 13.1's existing formula-injection neutralization, and the export filename is still built only from the fixed `reportKey` enum and numerically-validated period bounds, never from free text.

## 5. Seed data changed this phase

None. No new table, column, permission, or RLS policy — every new report definition and every extended list function composes an already-existing, already-RLS-governed query.

## 6. Validation performed

- **`pnpm --filter @ngc/services typecheck`** and **test** — clean; 458/458 passing (444 after the service-layer extensions alone, then 458 once all eleven new report-definition test files and the registry test rewrite were added — zero regressions to the pre-existing count at any step).
- **`pnpm --filter @ngc/web typecheck`** / **lint** (`next lint`) — both clean.
- **`pnpm --filter @ngc/web build`** (`next build`) — succeeds; all fourteen reports' routes compile.
- **Full workspace regression**: `pnpm typecheck` and `pnpm lint` clean across all 8 packages.
- **`e2e/reports.spec.ts`** extended from 5 to 8 tests: a sampled 13.2 report (Vendor) confirming its financial-field masking holds end-to-end, not just against a fake client; a plain member confirmed unable to see the Discipline Report in the picker or run/export it by forcing the URL (page shows the confidential-module message, export returns `403`); and a `discipline.cases.read` holder confirmed able to see, run, and export it. Full suite: **77/77 passing** (69 carried over + 8 in this file, no regressions elsewhere).
- **Security review**: an adversarial review (Agent-dispatched, independent of the implementation) — no exploitable defects found; findings in §4.

## 7. Open issues / deferred, not overlooked

- **Management KPI dashboards** remain PRD §15's separate V2 feature, not attempted here (§1).
- **Per-assignment asset activity reporting** and **Itinerary-level Logistics detail** remain out of scope, named in §1/§2.3 rather than silently omitted.
- **`hr`/`management` report definitions' test files** (`hr.test.ts`, `management.test.ts`) were the last two of eleven written this phase — same fake-client, query-shape-only coverage as every other definition's test file, not a substitute for the real-RLS verification each underlying list function's own test file already performs.
- With this sub-phase complete, **all of Phase 13 (Reporting) is now done.** Phase 14 (QA) is next, pending its own "proceed" instruction per the Development Control Rule.
