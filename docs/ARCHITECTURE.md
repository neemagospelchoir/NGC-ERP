# System & Technical Architecture
## Neema Gospel Choir (NGC) Institutional ERP Platform

**Document status:** Draft v1.0 — companion to `PRD.md`. Defines *how* the platform in the PRD is built. No application code is included or implied to exist yet; this is the blueprint implementation will follow, module by module, per the Development Control Rule (spec §73).

---

## 1. System Architecture Overview

```
                         ┌───────────────────────────┐
                         │   Public Web (Marketing,   │
                         │   /join, /invite, status)  │
                         └────────────┬──────────────┘
                                      │
┌───────────────────┐   ┌────────────▼──────────────┐   ┌───────────────────┐
│  Internal Web ERP  │   │      Shared API Layer      │   │  Mobile App        │
│  (Next.js)         │◄──┤  (Next.js Route Handlers /  ├──►  (React Native /   │
│  Role-based UI      │   │   Service Layer + Auth MW) │   │   Expo)            │
└───────────────────┘   └────────────┬──────────────┘   └───────────────────┘
                                      │
                         ┌────────────▼──────────────┐
                         │        Supabase            │
                         │  Postgres + RLS + Auth +   │
                         │  Storage + Realtime + Edge │
                         │  Functions                  │
                         └────────────┬──────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
        ┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
        │ Notification   │   │ PDF/Report       │   │ External Provider │
        │ Dispatcher      │   │ Generation       │   │ Adapters (SMS,     │
        │ (queue-driven)  │   │ Service          │   │ WhatsApp, Email,   │
        └───────────────┘   └─────────────────┘   │ AI/LLM)            │
                                                    └──────────────────┘
```

**Guiding principle:** one backend, one schema, one auth system, one set of business rules. Web and mobile are two clients of the same API/service layer and the same Supabase project — they must never diverge into separate logic paths for the same operation (e.g., "approve leave" must be one service function called by both clients, not reimplemented twice).

---

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Web frontend | Next.js (App Router) + TypeScript + React + Tailwind CSS | Server rendering for public pages (SEO for `/join`, `/invite`, marketing), PWA-capable, one codebase for public + internal ERP via route grouping and middleware-based access control |
| Mobile | React Native + Expo + TypeScript | Shares TypeScript types/business-logic packages with web via a monorepo; Expo simplifies push notification and OTA update tooling |
| Backend/DB | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) | Managed Postgres with native Row Level Security, integrated auth and object storage, reduces custom infra while keeping full SQL control |
| API layer | Next.js Route Handlers + a dedicated `services/` domain layer, thin Supabase Edge Functions for privileged/service-role operations | Keeps business logic out of the database and out of the client; a clear seam for validation, authorization, and audit logging |
| State/data fetching | React Query (web + mobile) | Consistent caching/offline-friendly data layer across clients |
| PDF generation | Server-side rendering (e.g., a headless-Chromium or PDF-library based renderer) invoked from an Edge Function/API route | Needed for letters, gate passes, itineraries, reports — never client-only |
| Notifications | Central `notifications` + `notification_templates` tables, a dispatch worker (Supabase Edge Function on a schedule/queue), pluggable channel adapters | Decouples "what triggers a notification" from "how it's delivered" |
| Hosting | Vercel (web), Supabase Cloud (backend), EAS Build/Submit (mobile) | Matches spec's recommended infrastructure; automated deploy pipelines |
| CI/CD | GitHub Actions | Lint, typecheck, test, build, migration-check gates before merge |
| Monitoring/error logging | Structured server logs + an error-tracking service (e.g., Sentry-class tool), configured via environment variables | No secrets hardcoded; provider swappable |

No third-party credentials are ever hardcoded; every provider (SMS, WhatsApp, Email, AI, error tracking) is selected and keyed through environment variables plus an administration Settings UI that stores only non-secret configuration (e.g., "which provider is active"), never the credential itself in application tables.

---

## 3. Monorepo & Folder Structure

```
ngc-erp/
├── apps/
│   ├── web/                     # Next.js app (public site + internal ERP, route-grouped)
│   │   ├── app/
│   │   │   ├── (public)/        # /, /join, /invite, /status, /awards, /media
│   │   │   ├── (erp)/           # authenticated internal app, per-module route groups
│   │   │   │   ├── dashboard/
│   │   │   │   ├── members/
│   │   │   │   ├── attendance/
│   │   │   │   ├── leave/
│   │   │   │   ├── discipline/
│   │   │   │   ├── invitations/
│   │   │   │   ├── events/
│   │   │   │   ├── calendar/
│   │   │   │   ├── technical/
│   │   │   │   ├── inventory/
│   │   │   │   ├── uniform/
│   │   │   │   ├── logistics/
│   │   │   │   ├── finance/
│   │   │   │   ├── media/
│   │   │   │   ├── communications/
│   │   │   │   ├── management/        # approvals, agenda, voting
│   │   │   │   ├── documents/
│   │   │   │   ├── reports/
│   │   │   │   └── administration/
│   │   │   └── api/             # thin route handlers delegating to services
│   │   ├── components/
│   │   └── middleware.ts        # auth/role gate for (erp) routes
│   ├── mobile/                  # Expo app
│   │   ├── app/                 # expo-router screens mirroring member-facing modules
│   │   ├── components/
│   │   └── app.config.ts
│   └── edge-functions/          # Supabase Edge Functions (notifications, PDF, scheduled jobs)
│
├── packages/
│   ├── services/                # domain/business-logic layer, framework-agnostic, used by web + mobile + edge functions
│   │   ├── members/  attendance/  leave/  discipline/  invitations/  technical/
│   │   ├── inventory/  uniform/  logistics/  finance/  media/  communications/
│   │   ├── management/  documents/  reports/  audit/  settings/
│   ├── db/                      # generated Supabase types, query builders, RLS policy source (SQL), migrations
│   ├── ui/                      # shared design-system components (web); mobile has its own themed primitives consuming the same tokens
│   ├── config/                  # shared constants that are NOT organization rules (e.g., enum types), zod schemas
│   └── notifications/           # channel adapters (sms, whatsapp, email, push) behind one interface
│
├── supabase/
│   ├── migrations/               # timestamped SQL migrations
│   ├── seed/                     # clearly labeled DEMO_* seed data only
│   └── config.toml
│
├── .github/workflows/            # CI pipelines
├── docs/                          # PRD.md, ARCHITECTURE.md, DATABASE.md, DESIGN_SYSTEM.md (added in later phases)
├── turbo.json / pnpm-workspace.yaml
└── package.json
```

Rationale: a monorepo (Turborepo/pnpm workspaces) lets `packages/services` be the single implementation of every business rule, called identically from Next.js route handlers, Edge Functions, and (via a typed API client) the mobile app — directly satisfying the "no duplicated business logic" and "web and mobile share the same backend/business rules" requirements.

---

## 4. GitHub Repository Structure & Branching

- Single monorepo (`ngc-erp`) rather than separate repos for web/mobile/backend, so that a change to a shared business rule (e.g., attendance percentage calculation) is one PR, not three repos to synchronize.
- Branches: `main` (production, protected, deploy-on-merge), `develop` (integration), `feature/<module-name>` (e.g., `feature/member-onboarding`, `feature/inventory`, `feature/finance`, `feature/invitations`, `feature/mobile-attendance`).
- Every PR into `develop` or `main` requires: lint pass, typecheck pass, unit/integration test pass, build success, and a manual security/permission review checklist (matches spec §65).
- Commits are scoped per logical change (e.g., `feat(finance): add contribution campaign CRUD + RLS policies`), never one commit for an entire module, let alone the entire ERP.
- Release tagging follows semantic versioning per deployed increment (aligned to the MVP/V1/V2/V3 boundaries in `PRD.md §15`).

---

## 5. Authentication & Authorization Architecture

### 5.1 Authentication
- Supabase Auth (email/password + magic link) for all internal roles and Choir Members.
- Applicants and Guests use a **token-based** access model: a signed, expiring token tied to a single `applications` or `invitations` row, delivered via the applicant/organizer's email or phone at submission time, re-verified by a secondary identifier (email or phone) before revealing status detail. This avoids provisioning full accounts for one-time external users while still requiring two factors of knowledge to view a record (per `PRD.md §14.8`).
- MFA-ready: Supabase Auth supports TOTP MFA; enabling it is a configuration toggle in Administration Settings, enforced per-role (e.g., can be made mandatory for Super Admin/Finance/Discipline roles first).
- Session management via Supabase's JWT session tokens, short-lived access tokens + refresh tokens, revocation on password change/role change/suspension.

### 5.2 Authorization — defense in depth
Two enforced layers, never just one:

1. **Database layer (primary, non-bypassable):** every table with member-sensitive or confidential data has Row Level Security enabled. Policies reference a `user_roles` / `role_permissions` mapping and, where relevant, scoping columns (`department_id`, `family_id`, `member_id`) so that, for example, a Department Leader's `SELECT` policy on `attendance_sessions` is restricted to `department_id = current_user_department()`. Discipline and confidential-document tables have policies that only allow the Discipline role (or the specific case owner) to read, regardless of any other role's general permissions — this directly enforces spec §33/§53 ("a Finance user should not automatically access confidential disciplinary records") at the layer that cannot be bypassed by a client bug.
2. **Application layer (defense in depth + UX):** a shared `authorize(user, action, resource)` function in `packages/services` is called at the top of every service function and every API route handler; the UI additionally hides actions a user cannot perform, but this is a UX convenience, never the sole gate (spec §6: "Do not rely only on frontend hiding").

### 5.3 Permission model
- `roles` (static catalog + custom roles allowed), `permissions` (module + action, e.g., `finance.expenses.approve`), `role_permissions` (mapping, admin-editable), `user_roles` (a user may hold multiple roles simultaneously).
- Scoped grants (department/family leader) are modeled as a `scope_type` + `scope_id` on `user_roles`, so "Department Leader of Alto Department" is a single row, not a hardcoded role name per department.
- All permission checks resolve through one function so that changing a permission in Administration → Roles takes effect everywhere immediately, with no code deployment.

---

## 6. Database Architecture

### 6.1 Entity groups (ERD narrative — full DDL to follow in Phase 4 `DATABASE.md`/migrations)

```
users ──< user_roles >── roles ──< role_permissions >── permissions

members ──1:1── member_profiles
members ──1:N── member_documents
members ──N:1── departments  (primary_department_id)
members ──N:M── departments  (member_departments, for secondary/historical)
members ──N:1── families      (via member_families, historical)
members ──1:N── probation
members ──1:N── attendance          (via attendance_sessions)
members ──1:N── leave_requests
members ──1:N── disciplinary_cases ──1:N── disciplinary_actions ──1:N── suspensions
members ──N:M── event_participants ──N:1── events
members ──1:N── event_attendance
members ──1:N── contribution_records ──N:1── contribution_campaigns
members ──1:N── expense_requests
members ──N:M── uniform_assignments ──N:1── uniforms
members ──1:N── votes ──N:1── agendas
members ──1:N── audit_logs (actor_id)

applications ──1:1── application_documents(N) ──(on approval)──> members (application_id FK, one-directional link, application row retained permanently)

invitations ──1:1── events (an approved invitation instantiates exactly one event)
events ──1:N── event_requirements
events ──1:1── technical_riders ──1:N── playlist / playlist_items
events ──1:N── gate_passes ──1:N── gate_pass_items ──N:1── assets
events ──1:N── logistics/trips ──1:1── itineraries
events ──1:N── media_links

assets ──N:1── asset_categories
assets ──1:N── asset_assignments (to member, department, or event)

vendors ──N:1── vendor_categories
vendors ──N:M── logistics / procurement_requests / gate_passes (as applicable)

procurement_requests ──N:1── expenses  ──(approval chain)──> purchase_orders ──(receipt)──> assets (new asset row, linked)

documents ──1:N── document_versions
documents ──N:1── document_categories

notifications ──N:1── notification_templates
audit_logs (append-only, references any table+record generically via record_type/record_id)
system_settings (key-value + typed config, versioned)
```

### 6.2 Design decisions and adjustments from the spec's entity list

- **`members` is the single identity table** referenced by every other domain (attendance, finance, events, discipline, uniform, family/department). No module creates a parallel person record — this directly implements `PRD.md §8`.
- **`applications` is retained permanently, even after conversion to `members`**, linked by a nullable `member_id` FK set at approval time — satisfying "historical member data must never be destroyed" while still avoiding a duplicate identity once converted.
- **`event_requirements` is split from `technical_riders`**: `event_requirements` captures what the *organizer/event* needs at a business level (from the invitation), while `technical_riders` is the Technical Department's operational realization of those requirements against actual inventory — this separation lets Technical iterate on the rider without mutating the original invitation record (auditability).
- **`asset_assignments` is generic** (polymorphic target: member, department, or event) rather than three separate tables, since the spec's own equipment-assignment example assigns to an *event*, uniform assignment to a *member*, and some inventory to a *department* — one assignment table with a `target_type`/`target_id` pair avoids duplicating assignment/return/damage logic three times.
- **`comments` is a generic, polymorphic table** (attachable to disciplinary cases, invitations, agenda items, expense requests, etc.) rather than a comments column bolted onto each table, since many modules in the spec need threaded comments (discipline, agenda/voting, approvals).
- **`suspensions` is modeled as a subtype of `disciplinary_actions`** (an action with `action_type = 'suspension'` plus start/end date columns) rather than a fully separate parallel table, since a suspension is always the output of a disciplinary or inactivity-driven decision and should share the same audit/approval scaffolding.
- **A single generic `audit_logs` table** (actor, action, module, record_type, record_id, before_value JSONB, after_value JSONB, ip, device, created_at) is used platform-wide rather than per-module audit tables, so the Audit Log screen and its access control are implemented once.
- **RLS is applied per-table, not per-module**, meaning `disciplinary_cases`, `disciplinary_actions`, and any document row tagged `category = 'discipline'` all carry the same restrictive policy independently — confidentiality is not just a UI-level module boundary.

### 6.3 Indexing & performance
- Foreign keys indexed by default; composite indexes on frequent filter patterns: `attendance(member_id, session_date)`, `contribution_records(campaign_id, member_id)`, `audit_logs(record_type, record_id, created_at)`, `events(status, event_date)`.
- Materialized or regularly-refreshed summary views for dashboard aggregates (attendance %, contribution totals) to keep KPI dashboards fast at scale without recomputing from raw rows on every page load.

### 6.4 Constraints & data integrity
- `member_id`, `application_number`, `invitation_number`, `gate_pass_id`, and asset `serial_number` are enforced unique at the database level, generated server-side from configurable format templates (never client-generated), and never reused even if a record is later archived.
- Soft-delete/archive pattern (`status = 'archived'` + retained row) used for members, assets, and documents instead of hard deletes, consistent with "historical data must never be destroyed."
- All monetary amounts stored as integer minor-units (e.g., cents) or `numeric` with explicit currency column, never floating point.

---

## 7. API Architecture

- **Route handlers are thin.** Each Next.js API route (and each mobile-facing endpoint) validates input (zod schemas shared from `packages/config`), calls exactly one function in `packages/services`, and returns a typed response — no business logic lives in the route file itself.
- **Authentication middleware** resolves the Supabase session/JWT and attaches the authenticated user + resolved roles to the request context before any handler runs.
- **Authorization middleware** wraps each service call with the shared `authorize()` check described in §5.3; a denied check returns a uniform 403 with no information leakage about the underlying record.
- **Validation:** all input validated against schemas before touching the database; invalid input returns structured 400 errors (field-level messages), never a raw database error.
- **Pagination, filtering, sorting:** standardized query-param contract (`?page=&pageSize=&sort=&filter[...]=`) applied consistently across list endpoints (members, invitations, assets, transactions, reports).
- **Rate limiting:** applied at the edge (reverse proxy/Vercel + Supabase's own limits) especially on public, unauthenticated endpoints (`/join`, `/invite`, status lookups) to prevent abuse.
- **Error handling:** a single error-normalization layer maps internal exceptions to safe, generic client-facing messages; full stack traces and query details go only to server-side structured logs, never to the client (spec §67, §52).
- **No blind table exposure:** Supabase's auto-generated REST/GraphQL surface is not exposed directly to end-user clients for sensitive tables; access goes through the service layer/API routes so business rules and RLS combine, rather than relying on RLS alone against a generic table endpoint. (RLS remains the safety net even if this rule is ever violated, but it is not the primary interface.)

---

## 8. Web Application Architecture

- Next.js App Router with two route groups: `(public)` — server-rendered, SEO-friendly, includes the marketing site, `/join`, `/invite`, and public status-check pages — and `(erp)` — authenticated, role-gated via middleware that checks the session and redirects unauthorized roles away from module routes they cannot access (in addition to, not instead of, API-level and RLS-level checks).
- Each module route (`/members`, `/finance`, etc.) is its own directory with list/detail/create/edit sub-routes, consistent loading/empty/error states (spec §67), and a shared layout providing the role-specific navigation (only modules the user has at least read access to appear in navigation).
- Progressive Web App capability (manifest + service worker) for the internal ERP to support installability and basic offline caching of read-mostly data (announcements, calendar).

---

## 9. Mobile Application Architecture

- Expo/React Native app using `expo-router`, sharing `packages/services` (business logic) and `packages/ui` design tokens with web, but with mobile-specific screen compositions (not shrunk desktop layouts), per spec §54.
- Scope for V1 mobile: login, dashboard, profile, attendance, events/calendar, notifications, announcements, contributions (read/own), leave application, documents (read), constitution (read), voting, event assignments, QR code display/scan, application status.
- Push notifications via Expo's push service, tied to the same `notifications` table/dispatcher as web/email/SMS so a single trigger fans out to every channel a user has enabled.
- Offline: React Query persisted cache for read-mostly data (announcements, calendar, profile); attendance capture queues locally when offline and syncs with a server-side idempotency key (e.g., `session_id + member_id` uniqueness) to prevent duplicate/conflicting records on reconnect (spec §55).

---

## 10. Document Management Architecture

- Files stored in Supabase Storage buckets mirroring the categories in spec §56 (`member-documents`, `applications`, `events`, `technical`, `inventory`, `finance`, `contracts`, `media`, `reports`, `constitution`), each bucket private by default.
- Access is via short-lived signed URLs generated per request after an authorization check in the service layer — never permanent public URLs for confidential categories (spec §14, §56).
- `documents` + `document_versions` tables track owner, category, tags, expiry date, and version lineage; uploading a new version creates a new `document_versions` row rather than overwriting the file, and previous versions remain retrievable (with audit trail of who restored/archived what).

---

## 11. Notification Architecture

- Central `notifications` table (recipient, channel, template, payload, status: queued/sent/failed, triggering event) and `notification_templates` (per spec §36 examples: rehearsal reminder, event reminder, contribution reminder, attendance warning, birthday, announcement, emergency).
- A scheduled/queue-driven dispatcher (Supabase Edge Function or background worker) reads queued notifications and calls the appropriate channel adapter.
- Channel adapters share one interface (`send(recipient, message, metadata)`) with concrete implementations for in-app (write to `notifications` + realtime push to client), push (Expo/web push), email, SMS, and WhatsApp — each adapter's provider credentials come from environment variables and are selected/enabled via Administration Settings, never hardcoded (spec §36, §60).
- WhatsApp adapter is built against an approved WhatsApp Business Platform/BSP API only; if no approved provider is configured, the WhatsApp channel is simply disabled in Settings rather than falling back to any unofficial method (spec §36).
- Every module that can trigger a notification (spec §58's list) calls one shared `notify(event, context)` function rather than composing messages ad hoc, so templates and channel logic stay centralized.

---

## 12. Approval Workflow Engine Architecture

Because multiple modules (invitations, expenses, gate passes, applications, procurement) need *configurable, multi-step, role-based* approval chains, a single reusable workflow primitive is used rather than one-off logic per module:

- `workflow_definitions` (per module/record type: ordered list of steps, each step naming a required role or specific user, and whether the step is mandatory or conditional).
- `workflow_instances` (one per record needing approval, tracks current step and overall status).
- `workflow_step_decisions` (approver, role, decision [approve/reject/request-changes], comment, timestamp, IP/device where legally appropriate) — this is the same structure that feeds spec §21's "every approval must record approver, role, decision, comment, date/time."
- The **Management Approval Center** (spec §44) is simply a permission-scoped query across all open `workflow_instances` where the current user matches the pending step's required role/user — one UI, reused across every approvable record type, rather than a bespoke inbox per module.
- Advancing a step triggers the module's next automated action (e.g., invitation fully approved → publish to calendar + notify departments) via the same event-driven `notify()`/domain-event mechanism used elsewhere, keeping the workflow engine decoupled from module-specific side effects.

---

## 13. QR Code Architecture

- QR payloads encode only an opaque, signed reference token (e.g., a short-lived or record-bound signed identifier), never raw member IDs, financial data, or PII directly — scanning resolves the token server-side against the authorized user's permissions before returning any detail (spec §59).
- Use cases: Member ID card (identity display, not raw auth), Event/Attendance check-in (token bound to `event_id` + rotating validity window), Asset tag (resolves to asset detail for authorized inventory staff), Gate Pass (resolves to pass detail/approval status for authorized checkpoint staff), Invitation status (organizer-facing, resolves only to the public-safe status view).

---

## 14. AI Features Architecture

- All AI-assisted functions (spec §57: draft letters, summarize reports/meetings, generate summaries, identify attendance trends, suggest eligible participants, suggest missing application info, categorize/extract from documents, generate report narratives) are implemented as **advisory service calls** that return a suggestion object, never a direct database write.
- A human user must explicitly accept/edit and submit an AI suggestion before it becomes an official record (e.g., a rejection letter's *reason* is always human-authored; AI only formats it into letter prose, matching spec §43 precisely).
- AI suggestions for event eligibility (spec §26) are clearly labeled "Recommended" alongside the deterministic eligibility computation (attendance %, leave, discipline, suspension) which is calculated by ordinary business logic, not AI — AI may only re-rank or annotate within the set the deterministic rules already produced, and any manager override is captured with a mandatory reason field.
- The AI provider is a swappable, environment-configured adapter (no vendor lock-in assumed), and no AI action is ever exempt from the same authorization/audit-logging path as a human-initiated one — every AI-assisted draft is logged as such in `audit_logs`.

---

## 15. Reporting Architecture

- A single `reports` service exposes parameterized report definitions (module, filters: monthly/quarterly/yearly/custom, format: PDF/Excel/CSV) rather than one bespoke export per module.
- Report queries run against the same RLS-protected tables/views the live UI uses, so an export can never contain data the requesting user could not otherwise see on-screen.
- PDF export reuses the same rendering service as letters/gate passes/itineraries; Excel/CSV export uses a shared tabular-export utility fed by the same underlying query, avoiding format-specific duplicate logic.

---

## 16. Security Architecture

- **Transport:** HTTPS/TLS everywhere (enforced at hosting layer); no plaintext endpoints.
- **AuthN/AuthZ:** covered in §5; MFA-ready; session expiry and refresh; role/permission changes invalidate cached authorization immediately.
- **Input handling:** schema validation on every input boundary (API routes, Edge Functions); parameterized queries only (Supabase client libraries prevent raw SQL string interpolation by default) — no SQL injection surface; output encoding/escaping in the web client prevents XSS; CSRF protection via same-site cookies and token verification on state-changing requests where cookie-based sessions are used.
- **Secrets:** all provider credentials and API keys live in environment variables managed by the hosting/Supabase project settings, never committed to Git, never present in client-side bundles (server-only env vars for anything sensitive).
- **Rate limiting & abuse prevention:** especially on public unauthenticated endpoints (`/join`, `/invite`, status lookups, login) to prevent enumeration and brute-force.
- **Logging:** structured server-side logs exclude secrets and full PII payloads where avoidable; audit logs are the authoritative record of sensitive actions and are themselves access-restricted (spec §51).
- **Least privilege & confidentiality boundaries:** enforced per §5.3/§6.4 — Finance cannot read Discipline detail and vice versa, by database policy, not convention.
- **Dependency & supply chain hygiene:** lockfile-pinned dependencies, automated dependency-audit step in CI, minimal dependency footprint (spec §64: "no unnecessary dependencies").

---

## 17. Deployment & DevOps Architecture

- **Environments:** local/dev, staging (mirrors production schema, seeded with clearly labeled `DEMO_*` data only), production.
- **CI/CD (GitHub Actions):** on every PR — install, lint, typecheck, unit tests, build; on merge to `develop` — deploy to staging + run migration dry-run; on merge to `main` — run pending Supabase migrations, then deploy web (Vercel) and trigger mobile OTA update (Expo EAS) where applicable; native app-store builds triggered on tagged releases.
- **Database migrations:** every schema change is a timestamped, reversible SQL migration under `supabase/migrations`; no manual production schema edits.
- **Backups:** automated daily Supabase backups plus point-in-time recovery where available on the chosen plan; backup restoration tested periodically, not just configured.
- **Monitoring:** uptime/error monitoring on both the web app and Edge Functions; failed notification-dispatch and failed-migration alerts routed to Super Admin/technical maintainer.
- **Environment variables/secrets:** managed through the hosting provider's and Supabase's secret stores, scoped per environment (staging secrets never equal production secrets).

---

## 18. Offline & Sync Architecture (Mobile)

- Read-mostly data (announcements, calendar, own profile, constitution) cached locally via React Query's persisted cache; served from cache when offline with a visible "offline/last updated" indicator.
- Attendance capture is the one write-path explicitly supported offline (per spec §55): a locally queued attendance record carries a client-generated idempotency key; on reconnect, the server upserts on that key rather than inserting a duplicate, and any conflicting server-side state (e.g., the session was cancelled meanwhile) surfaces as a sync conflict the user/officer must resolve rather than being silently overwritten.
- No other write operations (finance, discipline, approvals) are permitted offline in V1/V2 given their sensitivity and need for real-time authorization checks; this scope is revisited only if a genuine institutional need is demonstrated.

---

## 19. Development Roadmap (Phase Sequencing)

Follows the governing spec's Phase 1–15 structure (§63) directly:

1. Discovery (this document + PRD) → 2. PRD → 3. Architecture → 4. Database (`DATABASE.md` + migrations) → 5. Design System (`DESIGN_SYSTEM.md`) → 6. Authentication → 7. Core ERP (Users, Members, Departments, Families, Onboarding, Attendance, Leave, Discipline, Events/Invitations, Approvals) → 8. Operations (Technical, Inventory, Gate Pass, Uniform, Logistics, Vendors, Procurement) → 9. Finance (Contributions, Expenses, Petty Cash, Vendors, Procurement, Financial reports) → 10. Communication (Announcements, Notifications, SMS, WhatsApp, Email, Calendar, Voting) → 11. Media (Media links, Music, Playlists, Worship in Spirit, Event media) → 12. Mobile → 13. Reporting → 14. QA → 15. Deployment.

Each phase follows the Development Control Rule (spec §73): explain scope → identify dependencies/DB/API changes → implement → test → lint → build → security review → authorization review → report completed functionality and open issues → do not proceed until stable. No phase after Phase 3 begins without explicit approval of this document and `PRD.md`.

---

## 20. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope is very large for a small institution to operate long-term | MVP/V1/V2/V3 phasing (`PRD.md §15`) so a usable system ships early; later modules are additive, not blocking |
| Confidential data (discipline) leaking across roles | RLS enforced at the database layer, independent of application code correctness |
| Organization-specific rules hardcoded by mistake during fast implementation | All rules listed in spec §60 tracked as a checklist item in every relevant phase's security/authorization review (spec §73 step 9–10) |
| WhatsApp/SMS provider unavailable at launch | Channels are independently toggleable; platform launches fully functional on in-app/push/email alone |
| Duplicate "member" records emerging in a module built in isolation | Single `members` table + service-layer convention enforced in code review; documented in this architecture as a hard constraint (§6.2) |
| AI suggestions mistaken for authoritative decisions | UI clearly labels AI output as "Suggested"/"Draft"; every AI-touched record still requires the same human approval step as a fully manual one |

---

## 21. Open Items Requiring NGC/SPEK Decision Before Phase 4

These mirror `PRD.md §14` and are repeated here because they have direct schema/architecture impact: final ID/number formats; final approval chain membership per workflow; SMS/WhatsApp provider selection; MFA enforcement policy per role; hosting/domain ownership confirmation; whether Applicants/Guests get token-only access or full accounts (assumed token-only above). Confirming these before Phase 4 avoids schema rework.
