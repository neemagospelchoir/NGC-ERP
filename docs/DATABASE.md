# DATABASE.md — Phase 4 Deliverable
## Neema Gospel Choir (NGC) ERP — Schema, RLS Strategy, Seed Data, Validation

**Status:** Implemented and validated against a live PostgreSQL 16 instance (see "Validation performed" below). This document reflects what was actually built in `supabase/migrations/` and `supabase/seed/`, not a plan for future work.

---

## 1. Migration inventory

| # | File | Contents |
|---|---|---|
| 0001 | `extensions_and_helpers.sql` | Extensions (pgcrypto, citext, pg_trgm); local-dev `auth` schema shim (guarded, never runs against a real Supabase project); `set_updated_at()`, `write_audit_log()` triggers; `next_formatted_id()` configurable ID generator |
| 0002 | `rbac.sql` | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`; `has_permission()`, `has_role()`, `current_user_department_ids()`, `current_user_family_ids()` |
| 0003 | `lookup_and_org_structure.sql` | `lookup_values` (generic admin-editable categories/statuses), `departments`, `families` |
| 0004 | `members.sql` | `members` (single identity table), `member_departments`, `member_families`, `member_profiles` |
| 0005 | `onboarding.sql` | `applications`, `application_documents`, `probation` |
| 0006 | `attendance_leave.sql` | `attendance_sessions`, `attendance`, `member_attendance_summary` (view), `leave_requests` |
| 0007 | `discipline.sql` | `disciplinary_cases`, `disciplinary_actions` (suspension modeled as a subtype) |
| 0008 | `invitations_events.sql` | `invitations`, `events`, `event_requirements`, `event_participants`, `event_attendance` |
| 0009 | `technical.sql` | `technical_riders`, `playlists`, `playlist_items` |
| 0010 | `inventory.sql` | `asset_categories`, `assets`, `asset_assignments` (generic/polymorphic) |
| 0011 | `gate_pass.sql` | `gate_passes`, `gate_pass_items` |
| 0012 | `uniform.sql` | `uniforms`, `uniform_assignments` |
| 0013 | `vendors_logistics.sql` | `vendor_categories`, `vendors`, `trips`, `itineraries` |
| 0014 | `finance.sql` | `contribution_campaigns`, `contribution_records`, `contribution_campaign_summary` (view), `expense_requests`, `procurement_requests`, `purchase_orders` |
| 0015 | `documents.sql` | `document_categories`, `documents` (generic/polymorphic), `document_versions`; wires forward-declared FKs from 0005/0006/0013/0014 |
| 0016 | `communications.sql` | `notification_templates`, `notifications`, `announcements`, `media_links` |
| 0017 | `governance.sql` | `agendas`, `votes`, `agenda_results` (view) |
| 0018 | `comments.sql` | `comments` (generic/polymorphic, ordered after everything it references) |
| 0019 | `workflow_engine.sql` | `workflow_definitions`, `workflow_definition_steps`, `workflow_instances`, `workflow_step_decisions` |
| 0020 | `audit_and_settings.sql` | `audit_logs`, `system_settings` |
| 0021 | `audit_triggers.sql` | Attaches `write_audit_log()` to every sensitive table |
| 0022 | `security_hardening.sql` | Makes `next_formatted_id()` `SECURITY DEFINER`; revokes direct table access to the internal `_id_sequences` counter |

Migrations are strictly ordered by filename and are the single source of truth for schema history — no manual production schema edits (ARCHITECTURE.md §17).

---

## 2. Design decisions that refine the spec's raw entity list

Per the governing spec's own instruction ("adjust the schema where architectural analysis shows a better model... avoid unnecessary duplication"), five deliberate consolidations were made, each documented at the point of implementation:

1. **`members` is the single identity table.** Every other domain table (attendance, finance, events, discipline, uniform, family/department) references `members(id)`. No module creates a parallel person record.
2. **`asset_assignments` is generic/polymorphic** (`target_type` ∈ {member, department, event}) rather than three near-identical tables, since the spec's own examples assign equipment to an *event*, uniforms to a *member*, and general stock to a *department*.
3. **`comments` is generic/polymorphic** (`owner_type` ∈ {disciplinary_case, invitation, agenda, expense_request, gate_pass, application, procurement_request}) instead of a comments column bolted onto each table. Its RLS policy is owner-type-aware: a comment on a `disciplinary_case` requires the Discipline permission regardless of any other role, exactly as confidential as the case itself.
4. **`disciplinary_actions.action_type = 'suspension'`** (with start/end date columns) models a suspension as an action subtype rather than a fully separate `suspensions` table, since a suspension always originates from a disciplinary or inactivity-driven decision and shares the same audit/approval scaffolding.
5. **`documents` is generic/polymorphic** (`owner_type` ∈ {member, department, event, vendor, asset, invitation, disciplinary_case, expense_request, constitution, organization}), consolidating what the raw spec entity list names as separate `member_documents` and a general document-management module into one implementation. Confidentiality-aware RLS applies per-category (`document_categories.is_confidential`), so evidence documents attached to discipline stay exactly as protected as `disciplinary_cases` itself. **`application_documents` was kept separate**, because applicants have no Supabase Auth session at all (token-based access, per §4 below) — their document uploads travel through a service-role-backed public endpoint with a completely different security model than the internal `documents` module, so merging them would have blurred two genuinely different access patterns.

A single generic, append-only `audit_logs` table (rather than per-module audit tables) backs the Audit Log screen platform-wide; a single `workflow_definitions` / `workflow_instances` / `workflow_step_decisions` engine (rather than bespoke approval logic per module) backs Invitations, Expenses, and Gate Passes today, extensible to Applications and Procurement without new tables.

---

## 3. Entity-relationship overview

```
auth.users (Supabase-managed) ──1:1── public.users
public.users ──< user_roles >── roles ──< role_permissions >── permissions

members ──1:1── member_profiles
members ──1:N── member_departments, member_families (current + full history)
members ──1:N── probation, attendance, leave_requests, event_participants, event_attendance
members ──1:N── contribution_records, expense_requests(requested_by), uniform_assignments
members ──1:N── disciplinary_cases, votes, audit_logs(actor)

applications ──1:N── application_documents ──(on approval, one-directional)──> members.application_id
invitations ──1:1── events ──1:N── event_requirements, event_participants, event_attendance,
                                    technical_riders(1:1), playlists(1:1)──N── playlist_items,
                                    gate_passes ──N── gate_pass_items ──N:1── assets,
                                    trips(1:1 itineraries), media_links

assets ──N:1── asset_categories;  assets ──1:N── asset_assignments (polymorphic target)
vendors ──N:1── vendor_categories;  vendors ──< trips, procurement_requests, purchase_orders
expense_requests ──1:N── procurement_requests ──1:N── purchase_orders ──(0/1)──> assets (created_asset_id)

documents ──N:1── document_categories;  documents ──1:N── document_versions
agendas ──1:N── votes;  comments (polymorphic) attach to disciplinary_cases/invitations/agendas/expense_requests/gate_passes/applications/procurement_requests

workflow_definitions ──1:N── workflow_definition_steps
workflow_instances ──N:1── workflow_definitions;  workflow_instances ──1:N── workflow_step_decisions

audit_logs: generic, references any (record_type, record_id) pair, append-only
system_settings: key/value configuration, admin-editable, versioned via updated_at/updated_by
lookup_values: generic (category, code) admin-editable registries (attendance_status, expense_category, uniform_category, payment_method, vocal_category, discipline_category, event_type)
```

---

## 4. Authentication model reflected in the schema

- Internal roles and Choir Members are real Supabase Auth users (`auth.users` ↔ `public.users`, 1:1).
- **Applicants and external Invitation organizers are NOT Supabase Auth users.** `applications` and `invitations` each carry `access_token_hash` + `verification_contact` instead. Their public-facing read/write paths run through a service-role-backed API endpoint that validates the token + secondary identifier server-side, never through a client-side RLS-scoped session — this is why neither table has a public/anon SELECT policy; there is intentionally no such path at the database layer at all.
- `auth.uid()` / `auth.role()` are provided natively by Supabase in a real deployment. Migration 0001 creates a guarded, local-development-only shim (an `auth` schema + `auth.users` + `auth.uid()`) so every RLS policy in this repository can be authored and tested against a plain local PostgreSQL instance without a running Supabase project. The shim never activates if a real `auth.uid()` already exists.

---

## 5. Row Level Security strategy

Every table except the internal `_id_sequences` counter (function-only access, see §7) has RLS enabled — 60 of 61 tables (61 counting `_id_sequences`) at last count, verified with:

```sql
select tablename from pg_tables t
join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
where t.schemaname = 'public' and c.relrowsecurity = false;
-- returns only: _id_sequences
```

Recurring policy shapes:

- **Self-scoped:** a member reads/updates their own row (`user_id = auth.uid()` / `member_id in (select id from members where user_id = auth.uid())`).
- **Permission-gated:** `public.has_permission('module.resource.action')`, resolved through one function so editing Administration → Roles takes effect everywhere with no redeploy.
- **Scope-gated (department/family leaders):** `department_id in (select current_user_department_ids())`, populated from `user_roles.scope_type/scope_id`.
- **Confidentiality-hard-gated, no self-access clause at all:** `disciplinary_cases`, `disciplinary_actions`, confidential-category `documents`, and `comments` on a `disciplinary_case` — these policies do **not** include a "member sees their own record" clause, by design, per spec §33/§53. If NGC later decides members should see their own resolved cases, that must be an explicit new policy, not a default.
- **Read-only, admin-restricted, append-only:** `audit_logs` has a SELECT policy gated on `admin.audit_log.read` and an INSERT policy that only the `SECURITY DEFINER` audit trigger effectively uses in practice — there is no UPDATE/DELETE policy at all, so the table cannot be altered or purged by any role, ever.
- **Vote integrity vs. anonymity:** `votes` has a unique `(agenda_id, voter_id)` constraint (integrity) and a SELECT policy restricted to `voter_id = auth.uid() OR has_permission('management.agenda.manage')` (no member can see another member's vote, anonymous or not); the `agenda_results` view exposes only aggregate tallies.

---

## 6. Validation performed (not just written — run)

All of the following was executed against a real, disposable local PostgreSQL 16 instance as part of this phase, not asserted from reading the SQL:

1. **Clean sequential apply.** All 22 migrations applied in filename order with zero errors, twice (once during authoring, once as a from-scratch rebuild against a freshly created empty database to confirm reproducibility).
2. **Seed data apply.** `001_reference_data.sql` (15 roles, 49 permissions, 111 role→permission grants, 35 lookup values, 16 system settings, 3 workflow definitions with 9 steps) and `002_demo_data.sql` (clearly `DEMO_`-prefixed sample department, family, member, application, invitation, event, vendor, asset, contribution campaign, announcement) both applied cleanly.
3. **RLS coverage check.** Confirmed 60/61 tables have `relrowsecurity = true`; the one exception (`_id_sequences`) is intentionally function-gated instead (see §7).
4. **Confidentiality boundary, adversarial test.** Created real non-superuser Postgres sessions (a Postgres `authenticated` role with no RLS-bypass privilege, mirroring Supabase's actual role model) for a Finance Manager and a Discipline Manager. The Finance Manager's session read **0** rows from `disciplinary_cases`; the Discipline Manager's session read the case. This is the exact "a Finance user should not automatically access confidential disciplinary records" requirement (spec §33/§53), verified as a real query result, not inferred from the policy text.
5. **Member self-scoping test.** A plain Choir Member session (no special permissions) querying `select count(*) from members` returned **1** (only themselves) against a database that actually contained 2 members; an HR session (holding `members.profiles.read_all`) returned **2**.
6. **Audit log protection test.** A plain member's session reading `audit_logs` returned **0** rows (no `admin.audit_log.read` permission), while a superuser check confirmed the audit trigger had in fact recorded both members' INSERTs — i.e. logging happens unconditionally, but only admins can read it.
7. **ID-generator hardening test.** After migration 0022, an `authenticated` session could still call `next_formatted_id()` successfully (returned e.g. `TEST-2026-0001`) via its `SECURITY DEFINER` privilege, but a direct `select * from _id_sequences` from the same session failed with `permission denied for table _id_sequences` — confirming the "generate IDs only through the function, never touch the counter directly" design actually holds.
8. **Vote anonymity/integrity test.** One member cast a vote on an anonymous test agenda; a second member's session querying `votes` saw **0** rows (cannot see anyone else's vote); the voter's own session saw exactly **1** (their own).

These eight checks were chosen because they are exactly the confidentiality and integrity guarantees the PRD and governing spec call non-negotiable (§33, §51, §53, §45) — not an arbitrary sample.

---

## 7. Known follow-ups before Phase 5

- `_id_sequences` access pattern (function-only, `SECURITY DEFINER`, table grants revoked from `anon`/`authenticated`/`public`) should be re-verified once linked to a real hosted Supabase project, since Supabase's default role grants are provisioned by the platform itself and this migration's `REVOKE` statements need to run *after* Supabase's own setup, which the guarded `DO` blocks in 0022 already account for defensively.
- `vendors.bank_payment_information` and `.tax_information` currently rely on the service/API layer to withhold those columns from non-Finance roles in list views (RLS grants row access; column-level projection is an API-layer responsibility) — this should get an explicit database-level column privilege (`REVOKE`/column `GRANT`) pass in Phase 6 once the service layer's read models are defined, as extra defense in depth.
- `disciplinary_cases.evidence_document_ids uuid[]` is application-layer validated against `documents(id)`, not a real foreign key (Postgres cannot FK into an array column) — Phase 7 (Discipline module) should add a application-layer integrity check or, if warranted, a join table instead.
- Real values for `system_settings` (`probation.default_duration_days`, `attendance.eligibility_threshold_percent`, `members.inactivity_window_days`, and the ID format templates) are illustrative defaults, not NGC policy — per PRD.md §14, these need confirmation before go-live but do not block further development since they are configuration, not schema.
