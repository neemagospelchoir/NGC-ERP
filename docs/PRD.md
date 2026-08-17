# Product Requirements Document (PRD)
## Neema Gospel Choir (NGC) Institutional ERP Platform

**Document status:** Draft v1.0 — for review and approval before implementation begins.
**Prepared for:** Neema Gospel Choir / SPEK LIMITED
**Scope of this document:** Phase 1 (Discovery) and Phase 2 (PRD) of the Master Prompt's Development Process. No application code has been written. Per the governing instructions, implementation does not begin until this document and the accompanying `ARCHITECTURE.md` are reviewed and explicitly approved.

---

## 1. Executive Summary

Neema Gospel Choir (NGC), founded on 12 June 1992 and based at AICT Chang'ombe Church in Dar es Salaam, has grown from eight founding members into an institution of 150+ members spanning worship, music production, media/television ("Worship in Spirit" on Crown TV), community outreach, youth mentorship, and charitable work through the Neema Gospel Choir Foundation. Its operations today — membership records, attendance, discipline, finance, event invitations, technical production, inventory, uniforms, logistics, media, and governance — are run without a single institutional system of record.

This PRD defines a production-grade ERP platform intended to become NGC's single source of truth: one member record flowing into attendance, finance, events, technical assignments, uniforms, discipline, and reporting, accessible through a public web presence, an internal web ERP, and a native mobile application, all sharing one backend, one authentication system, and one set of business rules.

This document intentionally does not prescribe organizational policy (e.g., actual disciplinary rules, actual contribution amounts, actual constitutional text). Every institutional rule is modeled as **configurable data**, entered and maintained by NGC administrators, never hardcoded into the application.

---

## 2. Organization Context (as supplied, not invented)

| Attribute | Value |
|---|---|
| Legal/ministry name | Neema Gospel Choir (NGC) |
| Founded | 12 June 1992 |
| Base | AICT Chang'ombe Church, Dar es Salaam, Tanzania |
| Governance relationship | Independent institutional ministry; church-affiliated but self-governing. The ERP must not encode AICT as a controlling authority over NGC data or approvals unless an administrator explicitly configures such a relationship. |
| Size | 150+ members (growing) |
| Flagship program | "Worship in Spirit" — broadcast on Crown TV and digital platforms |
| Notable releases | Nikurejeshee; Mungu ni Mmoja (feat. Bella Kombo); Mwema; future releases |
| Recognitions | Best Gospel Choir — East Africa Gospel Music Awards 2025; Tanzania Gospel Music Awards 2025; Tanzania Gospel Excellence Awards 2026; future awards |
| Foundation | Neema Gospel Choir Foundation — "Inspire, Empower, Transform for a Better World" (youth mentorship, charity, outreach) |

This context informs tone, module scope (e.g., a first-class Media/Music/"Worship in Spirit" module), and the reputational bar for the UI (Section 9 in `ARCHITECTURE.md` covers the design system separately), but no financial figures, disciplinary policy, membership counts beyond "150+", or constitutional clauses are assumed beyond what is stated above.

---

## 3. Objectives

1. Provide one authoritative digital record for every member, from application through active service, probation, discipline, leave, and (if it occurs) exit — without ever destroying history.
2. Eliminate duplicate data entry across HR, attendance, finance, events, technical, uniform, and inventory functions by making the member record the single upstream source.
3. Make every institutional decision (approval, suspension, expense, gate pass, vote) attributable to a named, authenticated, role-authorized human, with a timestamped audit trail.
4. Digitize the full external-facing lifecycle: applicant onboarding and event/invitation submission, both via secure public links, both flowing into internal approval workflows before anything is treated as accepted.
5. Give management real-time, role-scoped visibility into membership, attendance, finance, events, and inventory through KPI dashboards and exportable reports.
6. Ship a mobile application for members and leaders that shares the same backend, auth, and business rules as the web ERP — not a lightweight companion app with its own logic.
7. Encode all organization-specific rules (attendance threshold, probation length, ID formats, approval chains, categories) as administrator-configurable settings, not hardcoded constants.
8. Meet enterprise security and privacy expectations: RBAC enforced at the database layer (not just UI hiding), confidentiality of disciplinary records, least-privilege access, and full audit logging.
9. Build for multi-year institutional longevity: a normalized database, a documented API, a maintainable modular codebase, and a roadmap that scales from MVP to a full-featured platform without rewrites.
10. Use AI strictly as an assistant (drafting, summarizing, suggesting) — never as an autonomous decision-maker for membership, discipline, or finance.

---

## 4. Users and Personas

### 4.1 Internal roles (see Section 5 for the full matrix)

Super Administrator; Chairman; Vice Chairman; Secretary; Deputy Secretary/HR; Technical Manager/Director; Finance Manager; Discipline Manager; PRO/Spokesperson; Logistics Officer; Inventory Officer; Media Department; Department Leader; Family Leader; Choir Member.

### 4.2 External/limited-access personas

**Applicant** — a prospective member who has started or completed onboarding but is not yet a member. Has access only to their own application via a token-based lightweight account.

**Guest/External Organizer** — an outside party (church, institution, event organizer) submitting an invitation. No ERP account; interacts only through the public invitation link and a status-check page.

### 4.3 Representative user stories (non-exhaustive; the full set belongs in a backlog, not this PRD)

- As an HR Officer, I want a new member's approved application to automatically create their member profile, department assignment, and probation record, so I never re-key the same data.
- As a Finance Manager, I want to see, per contribution campaign, who has and hasn't paid and what is outstanding, so I can follow up efficiently.
- As a Technical Director, I want equipment I assign to an event to be automatically checked against availability and produce a gate pass, so nothing is double-booked or leaves the building unaccounted for.
- As a Choir Member, I want to see my own attendance percentage, upcoming events, and whether I am eligible for an upcoming performance, so I understand my standing without asking a leader.
- As the Secretary, I want a single Approval Center showing everything awaiting my decision across modules, so nothing is missed.
- As an external event organizer, I want to submit an invitation and later check its status with my invitation number, without needing an account.
- As the Chairman, I want an executive dashboard of membership, attendance, finance, and events, so I can govern with current data instead of verbal reports.

---

## 5. User Role Matrix

| Role | Primary Responsibility | Typical Access Level |
|---|---|---|
| Super Administrator | Full system configuration and access | System-wide, including settings and audit logs |
| Chairman | Top institutional approvals, oversight | Read-most, approve high-level items (invitations, discipline appeals, agenda) |
| Vice Chairman | Delegated management approvals | Same class as Chairman, scoped by delegation |
| Secretary | Institutional administration, major approvals | Cross-module approve/read, member and invitation administration |
| Deputy Secretary / HR | Member lifecycle, attendance, leave | Full HR module, read-only elsewhere unless granted |
| Technical Manager/Director | Technical riders, equipment, gate passes, playlists | Full Technical + Inventory (assignment) module |
| Finance Manager | Contributions, expenses, vendors, financial reports | Full Finance module, no discipline access |
| Discipline Manager | Disciplinary cases and actions | Full Discipline module (confidential), no finance access |
| PRO / Spokesperson | Communications, announcements, public info | Full Communications + Announcements, read-only Media |
| Logistics Officer | Transport, itineraries, logistics vendors | Full Logistics module |
| Inventory Officer | Assets, stock, gate passes | Full Inventory module |
| Media Department | Media links/content per event | Full Media module, read-only Events |
| Department Leader | Department members and activities | Scoped to own department |
| Family Leader | Family members and activities | Scoped to own family |
| Choir Member | Own profile and permitted self-service | Self-scoped only |
| Applicant | Own application only | Token-scoped, single record |
| Guest/External | Own invitation submission/status only | Token-scoped, single record, no login |

Roles are **assignable in combination** (e.g., a member can simultaneously be a Department Leader and hold no other office). Role assignment itself is an audited action performed by Super Administrator or Secretary.

---

## 6. Permission Matrix (representative — full matrix to be maintained as configuration data, not a static document)

Because permissions must be enforced at the database layer (Section 6 of the governing spec) and must remain configurable (Section 60), the authoritative permission matrix will live as seed data in the `permissions` / `role_permissions` tables (see `DATABASE` section of `ARCHITECTURE.md`), not as a document that goes stale. The table below illustrates the intended granularity using CRUD-style actions per module for a representative subset of roles.

| Module | Super Admin | HR/Dep. Secretary | Finance Manager | Discipline Manager | Technical Manager | Department Leader | Choir Member |
|---|---|---|---|---|---|---|---|
| Member Profiles | CRUD | CRUD | Read (non-financial) | Read (own cases only) | Read (contact/skills) | Read (own dept.) | Read (own only) + limited update |
| Applications/Onboarding | CRUD | CRUD, Approve | — | — | — | — | Create (self, as applicant) |
| Attendance | CRUD | CRUD | — | Read | Read (own events) | CRUD (own dept.) | Read (own) |
| Leave | CRUD | CRUD, Approve | — | — | — | Read (own dept.), Comment | Create (own), Read (own) |
| Discipline | CRUD | Read (non-detail) | — | CRUD | — | — | — |
| Finance/Contributions | CRUD | Read (summary) | CRUD | — | — | Read (own dept. summary) | Read (own) |
| Expenses/Petty Cash | CRUD | Create, Read | CRUD, Approve | — | Read (own requests) | Create, Read (own) | Create (own), Read (own) |
| Invitations/Events | CRUD | Read, Comment | Read (financial) | — | CRUD (technical fields) | Read | Read (assigned) |
| Technical Rider/Playlist | Read | — | — | — | CRUD | Read (assigned) | Read (assigned) |
| Inventory/Assets | CRUD | — | Read (value) | — | CRUD (assignment) | Read | — |
| Gate Pass | Approve | — | — | — | Create, Approve (tier 1) | — | — |
| Uniform | CRUD | Read | — | — | — | Read (own dept.) | Read (own) |
| Logistics | CRUD | Read | Read (cost) | — | Read | — | Read (assigned trip) |
| Media | CRUD | — | — | — | — | Read | Read (published) |
| Announcements | CRUD | Create | — | — | — | Create (own dept.) | Read |
| Documents/Constitution | CRUD | CRUD (HR docs) | CRUD (finance docs) | CRUD (discipline docs, confidential) | CRUD (technical docs) | Read | Read (published only) |
| Agenda/Voting | CRUD | — | — | — | — | — | Vote (if eligible), Read |
| Audit Log | Read | — | — | — | — | — | — |
| System Settings | CRUD | — | — | — | — | — | — |

Enforcement principle: every row above must be enforced by PostgreSQL Row Level Security policies and a server-side authorization middleware layer, not merely by hiding UI elements — see `ARCHITECTURE.md §6`.

---

## 7. Modules and Features

The platform is organized into the following modules. Each module's detailed field lists and statuses are taken directly from the governing specification (Sections 7–50); this PRD summarizes scope, ownership, and cross-module data flow rather than repeating every field.

### 7.1 Member Onboarding & HR
Public applicant link (`/join`) → application form (personal, church, education, professional, choir history, musical information, documents) → application number + progress percentage + status pipeline (Draft → Submitted → Incomplete → Pending Review → Under Verification → Pending Approval → Approved/Rejected → Probation → Probation Completed/Failed → Converted to Member) → approval/rejection letter (PDF, AI-assisted drafting with human-authored reason only) → Member ID issuance → probation record with configurable duration and leader-notification before expiry. Existing-member information updates use a **separate, simplified, versioned** workflow with full before/after audit trail — they never re-run the new-member application.

### 7.2 Departments & Families
Configurable department and family registries; leader assignment; member primary/secondary department and family assignment with historical tracking of all changes.

### 7.3 Digital Member Profile
Single profile view aggregating photo, Member ID (permanent, QR-enabled, configurable format e.g. `NGC-2026-0001`), contact, department/family, status, attendance %, contributions, discipline history (access-controlled), leave history, event participation, uniform allocation, documents, skills, and audit history.

### 7.4 Document Management
Categorized (Member, HR, Financial, Event, Technical, Logistics, Legal, Church, Constitution, Policy, Report, Contract, Media, Administrative), versioned, tagged, access-controlled, with expiry dates and audit trail. No confidential document is ever exposed via a permanent public URL — signed, time-limited URLs only.

### 7.5 Inventory / Asset Management
Full asset registry (ID, category, serial, purchase/current value, condition, custodian, location, availability, maintenance, documents/photos, assignment/return/damage/disposal history).

### 7.6 Event Equipment Assignment & Gate Pass
Technical Department assigns equipment to an approved event; system checks availability and blocks double-booking absent explicit override; auto-generates a Gate Pass (equipment list, responsible person, expected departure/return, QR code) requiring Technical Manager then Secretary approval (additional levels configurable); gate pass status lifecycle: Approved → Rejected/Checked Out → In Transit → Returned/Partially Returned/Damaged/Lost.

### 7.7 Logistics
Trip/transportation planning, vehicle/driver/vendor assignment, accommodation, fuel and cost tracking, itinerary generation, vendor database (categorized), configurable cost-estimation rules (no hardcoded prices).

### 7.8 Invitation / Event Management
Public invitation link (`/invite`) for external organizers; invitation number (`INV-2026-0001`); status pipeline (Draft → Submitted → Received → Under Review → Pending Information → Pending Management Approval → Approved/Declined → Cancelled → Completed → Postponed); configurable multi-step approval workflow (default: Secretary → Technical → Finance → Chairman/Management) with every decision recording approver, role, comment, and timestamp; external status check via invitation number + secure verification without exposing internal detail; invitation reporting (volume, approval rate, attendance rate, financial value, geographic distribution) with **Quarterly** as the standard period term used consistently platform-wide.

### 7.9 Technical Rider & Playlist
Auto-generatable Technical Rider per approved invitation (PA, mics, instruments, monitoring, stage, lighting, LED, camera, recording, power, crew, setup/soundcheck time) linked directly to Inventory; event-specific Playlist (song, sequence, key, duration, lead/backing vocal, instrument, notes) shareable with authorized users.

### 7.10 Attendance
Rehearsals, events, meetings, and other activities; configurable statuses (Present, Absent, Excused, Emergency Leave, Approved Leave, Late, + custom); automatic percentage calculation; default eligibility threshold 70% (configurable).

### 7.11 Member Event Eligibility
For a given event, the system computes an eligible/recommended member list from attendance %, discipline status, leave status, and event/department/technical/musical requirements, and surfaces reasons for exclusion; management can override with a mandatorily recorded reason. AI may suggest; AI never finalizes.

### 7.12 Leave / Absence Management
Member-initiated (emergency, planned, absence explanation) → HR/Secretary approval; approved leave correctly offsets attendance calculations; full audit of reason, dates, document, approver, comment.

### 7.13 Automatic Inactivity Rule
Configurable rule (default: 3 consecutive months with no activity, no leave, no HR/discipline explanation) flags "Potentially Inactive" and notifies HR, leader, and Super Admin; may recommend suspension, which requires policy-configured approval; restoration requires authorized admin, reason, date, and audit record. No automatic deletion, ever.

### 7.14 Finance — Contributions
Campaign-based (target, deadline); per-member contribution recording (amount, date, method, reference, status, notes); campaign dashboard (contributors, non-contributors, totals, outstanding, achievement %); member-level contribution summary; Monthly/Quarterly/Yearly/Custom filters.

### 7.15 Finance — Vendors
Categorized vendor registry (Transport, Uniform Tailor, Equipment, Printing, Accommodation, Catering, Other) with contact, tax/payment info (access-controlled), documents/contracts, performance notes, status. Shared across Logistics, Inventory, and Procurement.

### 7.16 Petty Cash / Expense Management
Request → configurable approval chain (Chairman/Secretary/Finance Manager) → statuses (Draft → Submitted → Pending Approval → Approved/Rejected → Paid → Closed); monthly expense reporting by department/event/vendor/category.

### 7.17 Procurement
Approved expense → Procurement → Vendor → Purchase → Payment → Inventory update; acquired assets automatically create/suggest an inventory record.

### 7.18 Discipline
Confidential module: warnings, comments, incidents, cases, suspensions, resolutions, follow-ups, strict access control; members do not see internal disciplinary detail unless policy explicitly allows.

### 7.19 Uniform Management
Type/size/quantity/condition/location registry; assignment to member and/or event with return tracking and full history.

### 7.20 Media
Per-event media links (YouTube, Facebook, Instagram, TikTok, Drive, livestream), photos, videos, press releases, coverage; sharable to specific members/departments/leaders/participants. First-class support for the "Worship in Spirit" program as a recurring media/event category.

### 7.21 Communications
In-app, push, SMS, WhatsApp (approved provider only — no unofficial automation), email; targeted to individual/department/family/event participants/broadcast; template library (rehearsal reminder, event reminder, contribution reminder, attendance warning, birthday, announcement, emergency).

### 7.22 Announcements
Title/message/image/attachment, targeted audience, publish/expiry date, priority, author.

### 7.23 Calendar
Unified institutional calendar (rehearsals, meetings, invitations, performances, Worship in Spirit, media production, department/family activities, contribution deadlines) with Month/Week/Day/Agenda views and reminder notifications (push/SMS).

### 7.24 External Event Submission
Public submission → validation → Invitation ID → admin notification → pending calendar state → approval workflow → on approval, publish to internal calendar and notify departments. Never auto-approved.

### 7.25 Logistics Itinerary
Auto-generated Trip/Itinerary Summary from an approved invitation (destination, dates, transport, driver, vendor, accommodation, technical requirements, assigned members, estimated/actual costs), exportable to PDF.

### 7.26 Member Event Attendance
Auto-generated attendance list for an approved event from eligible/assigned members; capturable via web, mobile, QR, or an authorized attendance officer; every change audited.

### 7.27 Application Status (Applicant-facing)
Application number (`APP-2026-0001`) + secure verification for status lookup; configured (not guaranteed) processing period, default display 7–21 working days; status pipeline as in §7.1.

### 7.28 Approval / Rejection Letters
Auto-drafted (AI-assisted formatting only, human-authored substantive reason), PDF, requiring authorized sign-off before dispatch.

### 7.29 Management Approval Center
Cross-module inbox of pending approvals (applications, leave, invitations, gate passes, expenses, procurement, uniform requests, discipline cases) with request detail, supporting documents, and Approve/Reject/Request Changes + comment actions.

### 7.30 Agenda & Voting
Management-created agenda items with description and voting deadline; configurable eligible-voter scope and vote method (Yes/No/Abstain); optional anonymous voting for sensitive items; system guarantees one-vote-per-eligible-member integrity.

### 7.31 Constitution & Guidelines
Versioned institutional documents (constitution, policies, guidelines, handbook, department guidelines) — members read current approved version; admins manage versions.

### 7.32 Dashboards
Role-specific: Member, HR, Finance, Technical, Logistics, Management/KPI (as enumerated in spec §47–48).

### 7.33 Reporting Engine
Centralized, filterable (Monthly/Quarterly/Yearly/Custom), exportable (PDF/Excel/CSV) reports across every module listed in spec §49.

### 7.34 Global Search
Permission-scoped search across members, applications, invitations, events, assets, vendors, documents, transactions, reports, announcements.

### 7.35 Audit Log
Mandatory, protected-from-ordinary-users log of user/action/module/record/before/after/timestamp/IP/device for all sensitive actions.

### 7.36 QR Code System
Secure-token-based QR codes for Member ID, events, attendance, assets, gate passes, invitations, and documents — never encoding sensitive data directly in the QR payload.

### 7.37 System Configuration
Administration area for attendance threshold, probation period, application processing period, ID/number formats, approval workflows, category registries (department, family, contribution, expense, vendor, asset, uniform), notification templates, provider selection (SMS/WhatsApp/Email), and organization information.

---

## 8. Cross-Module Data Flow (Single Source of Truth)

A member record created through Onboarding/HR is the upstream source for every other module. The system must not allow a second, independent "member" record to be created in Attendance, Finance, Events, Technical, Uniform, Discipline, Family, or Department modules — those modules reference the member via foreign key and add module-specific data, never a duplicate identity. This principle is enforced structurally in the database design (`ARCHITECTURE.md §7`) via a single `members` table referenced by every other domain table, and is a hard constraint on any future feature: no module may introduce its own parallel "person" entity.

The same single-source principle applies to Invitations → Technical Rider → Gate Pass → Inventory → Logistics → Media (one invitation record threading through every downstream artifact) and to Expense Requests → Procurement → Purchase Orders → Inventory (one financial request threading through to an asset record where applicable).

---

## 9. Key Workflows

### 9.1 Member Onboarding
```
Public Link (/join) → Application Form → Save as Draft/Submit
   → Application Number issued → Status: Submitted
   → HR Review → [Missing Info → Applicant notified → resubmit]
   → Under Verification → Pending Approval
   → HR/Secretary Decision:
        Approved → Letter (PDF) → Member ID issued → Probation created
                 → Department/Family/Leader assigned → Probation-expiry reminders
                 → Probation Completed → Converted to Member
        Rejected → Letter (PDF, human-authored reason) → Application closed
   → All status changes and letters are audit-logged
```

### 9.2 Invitation / Event Approval
```
Public Link (/invite) → Organizer submits → Invitation Number issued
   → Status: Submitted → Received → Under Review
   → [Pending Information → organizer notified] 
   → Approval chain (configurable, default: Secretary → Technical → Finance → Chairman)
        each step records approver, decision, comment, timestamp
   → Approved → published to internal Calendar → departments notified
        → Technical Rider generated → Equipment assigned (availability-checked)
        → Gate Pass generated → Technical Manager approval → Secretary approval
        → Logistics Itinerary generated → Member Eligibility computed
        → Attendance list generated → Uniform assigned
   → Declined/Cancelled/Postponed → organizer notified via status page
   → Completed → Media links attached → Reports updated
```

### 9.3 Expense / Procurement
```
Requester → Expense Request (description, amount, category, event/dept, document)
   → Configurable approval chain (Chairman/Secretary/Finance Manager)
   → Approved → Procurement → Vendor selection → Purchase → Payment → Closed
        → If item is an asset → Inventory record created/suggested
   → Rejected → Requester notified with reason
   → Monthly expense reports generated automatically
```

### 9.4 Discipline (confidential)
```
Authorized officer → Incident/Case created (evidence, category, description)
   → Investigation notes/comments (access-controlled)
   → Action decided (warning/suspension/other) → Resolution recorded
   → Suspension (if any) feeds Attendance/Eligibility calculations
   → Restoration (if applicable) requires authorized admin + reason + audit record
```

### 9.5 Approval Center (cross-cutting)
Every workflow above surfaces its pending step in the requester's and approver's Approval Center simultaneously; an approval action in the Center updates the originating module's status and triggers the next step/notification automatically.

---

## 10. Business Rules (configurable — values below are illustrative defaults only, not policy)

| Rule | Default (illustrative) | Configurable by |
|---|---|---|
| Attendance eligibility threshold | 70% | Super Admin / HR |
| Probation duration | Organization-defined (not assumed here) | Super Admin / HR |
| Application processing period (displayed, non-binding) | 7–21 working days | Super Admin / HR |
| Inactivity flag trigger | 3 consecutive months with no recorded activity | Super Admin / HR |
| Member ID format | `NGC-{year}-{sequence}` | Super Admin |
| Application number format | `APP-{year}-{sequence}` | Super Admin |
| Invitation number format | `INV-{year}-{sequence}` | Super Admin |
| Gate pass approval levels | Technical Manager → Secretary (extensible) | Super Admin |
| Invitation approval chain | Secretary → Technical → Finance → Chairman | Super Admin |
| Expense approval chain | Chairman / Secretary / Finance Manager (order configurable) | Super Admin |
| Voting eligibility & method | Per-agenda, Yes/No/Abstain, anonymous option | Agenda creator (management role) |

All of the above must be stored as rows in `system_settings` / workflow-configuration tables, never as constants in application code, per governing principle §71.11 and §60.

---

## 11. Reporting Requirements

All reports in spec §49 (member, attendance, contribution, expense, vendor, inventory/asset, event, invitation, logistics, technical, uniform, discipline, HR, management) must support Monthly/Quarterly/Yearly/Custom filters and PDF/Excel/CSV export, respecting the same row-level permission scoping as the underlying data (a Finance report never surfaces discipline detail, etc.).

---

## 12. Non-Functional Requirements

- **Security & Privacy:** RBAC enforced at both API and PostgreSQL RLS layers; least-privilege by default; disciplinary and financial confidentiality boundaries as described in spec §33/§53; MFA-ready auth; no secrets in source control or client bundles.
- **Auditability:** every create/update/delete on a sensitive table is logged with actor, before/after values, and timestamp; audit logs are read-only and admin-restricted.
- **Availability & Longevity:** designed for continuous multi-year operation with automated backups and migration discipline (no destructive schema changes without a reversible migration).
- **Performance:** dashboards and lists must remain responsive at 150+ members and multi-year historical data volume; reporting queries must be indexed appropriately (see `ARCHITECTURE.md §7.4`).
- **Responsiveness & Accessibility:** desktop, laptop, tablet, Android, iPhone; keyboard navigation, screen-reader labeling, color contrast, semantic HTML.
- **Offline tolerance (mobile):** cached announcements/calendar/profile and limited attendance capture with conflict-free sync on reconnect.
- **Configurability:** every organization-specific rule enumerated in spec §60 lives in administrable settings.
- **AI guardrails:** AI may draft, summarize, categorize, and suggest; AI may never autonomously approve, reject, suspend, or modify an official record (spec §57, §26, §43).

---

## 13. External Integrations Required

| Category | Purpose | Notes |
|---|---|---|
| SMS gateway | Attendance/contribution/event reminders, emergency notices | Provider selectable in Settings; Tanzania-capable provider required (e.g., a local aggregator) — specific vendor is a business decision, not assumed here |
| WhatsApp Business API/provider | Official templated messaging | Must be an approved Business Solution Provider integration; no unofficial automation (spec §36) |
| Email provider (transactional) | Letters, confirmations, digests | Configurable SMTP/API provider |
| Push notification service | Mobile/web push | Standard mobile push infrastructure (platform-native) |
| Cloud storage/auth/DB provider | Backend, auth, file storage, RLS | Supabase (PostgreSQL) recommended — see `ARCHITECTURE.md` |
| PDF generation | Letters, itineraries, gate passes, reports | Server-side rendering library |
| Hosting/CI-CD | Web deployment | Vercel or equivalent, per spec §4 |
| AI/LLM provider | Drafting/summarizing assistance only | Configurable; outputs always require human approval before becoming official |

No credentials for any of the above may be hardcoded; all are environment-variable/Settings-driven (spec §52, §60).

---

## 14. Ambiguities and Assumptions

The governing specification is unusually detailed, but several institution-specific policy decisions are intentionally **not** invented here, per its own instruction ("Do not invent organizational policies, financial rules, member information, or constitutional provisions"). These are flagged as open decisions for NGC leadership, with the reasonable enterprise-grade default the platform will ship with until configured otherwise:

1. **Actual probation duration, attendance threshold, and inactivity window** — defaults above are placeholders from the spec's own examples (70%, 3 months); real values must be confirmed by HR/Secretary and entered in Settings before go-live.
2. **Actual approval chain membership** (who specifically sits in each chain today) — modeled as configurable roles; real named individuals are assigned post-deployment by Super Admin.
3. **AICT Chang'ombe's formal relationship to ERP data** — assumed to have **no** automatic access or control per spec §71.2; if the choir wants to grant the church visibility into any data, that must be an explicit, auditable configuration choice, not a default.
4. **Constitution/policy content** — the Documents module ships empty of actual constitutional text; NGC must upload/author the real constitution and policies.
5. **Financial rules** (contribution categories, expense categories, actual amounts, currency handling beyond TZS default) — modeled as configurable categories with no invented figures.
6. **Member ID/Application/Invitation number formats** — the spec's examples (`NGC-2026-0001`, `APP-2026-0001`, `INV-2026-0001`) are adopted as the **default** configurable format, confirmable by Super Admin.
7. **WhatsApp/SMS provider selection** — left open; requires a business decision and contractual relationship with a Tanzania-capable provider before that channel can go live (other channels can launch without it).
8. **Whether Applicants/Guests require a lightweight authenticated account or purely token-based access** — this PRD assumes **token-based, no-password access** scoped to a single application/invitation record, re-verified by a secondary identifier (e.g., phone/email + application number), to minimize account-management overhead for one-time users. This should be confirmed.
9. **Anonymous voting mechanics** — assumed to mean votes are recorded without a visible voter-to-vote link in the UI for authorized viewers, while the system still enforces one-vote-per-member integrity internally (necessarily requiring *some* server-side linkage, cryptographically separated from the visible tally) — this is a reasonable enterprise interpretation of "anonymous" that preserves both privacy and vote integrity, and should be confirmed with leadership given its legal/trust sensitivity.
10. **Domain name and public URLs** (`ngc.co.tz`, `/join`, `/invite`) are used from the spec's own examples as placeholders; actual domain ownership/DNS must be confirmed.
11. **Church referral letter and other document requirements** — treated as configurable required/optional document types per application, not hardcoded mandatory fields.
12. **Mobile platforms** — assumed both Android and iOS are required (spec explicitly names both); app-store account ownership (Apple/Google developer accounts) is an NGC/operational decision outside this document's scope.

---

## 15. MVP / V1 / V2 / V3 Prioritization

**MVP (minimum to run real institutional operations digitally):**
Auth & RBAC; Member core profile, Departments/Families; Member Onboarding (applicant link → approval → Member ID → probation); Attendance; Leave; basic Discipline; Invitations/Events core workflow with configurable approvals; Approval Center; Announcements; Audit Log; System Settings; core Reporting (member, attendance, invitation); Member-facing web (responsive) — mobile app deferred to V1 if timeline requires, but backend/API must already be mobile-ready.

**V1 (operational completeness):**
Technical Rider, Playlist, Inventory/Assets, Gate Pass, Uniform, Logistics/Vendors/Itinerary; Finance (Contributions, Expenses/Petty Cash, Procurement); Member Event Eligibility; Automatic Inactivity Rule; Mobile application (member-facing core functions); Notification engine (in-app, email, push); Document Management; Calendar; Global Search.

**V2 (institutional maturity):**
SMS and WhatsApp channel integrations; Agenda & Voting; Constitution/Guidelines versioned library; Management KPI dashboards; full Reporting engine with PDF/Excel/CSV across all modules; Media module incl. "Worship in Spirit" content management; AI-assisted drafting features (letters, summaries, eligibility suggestions) with human-approval gates; offline mobile support.

**V3 (optimization & expansion):**
Advanced analytics/trend detection; expanded procurement/vendor performance analytics; anonymous voting hardening/legal review; deeper offline sync; public-facing marketing site enhancements (media gallery, awards, releases); potential future integrations (e.g., payment gateway for contributions, if NGC decides to accept digital payments — not currently specified).

This sequencing follows the governing spec's own Phase 7–13 ordering (Section 63) while grouping it into shippable increments; it will be revisited once effort estimation and staffing are known.

---

## 16. Acceptance Criteria for This Document

This PRD is considered ready for approval when NGC/SPEK leadership confirms: (a) the role and permission matrices in §5–6 reflect real organizational authority; (b) the business-rule defaults in §10 are acceptable placeholders pending real values; (c) the ambiguities in §14 have documented answers or explicit acceptance of the stated default; (d) the MVP/V1/V2/V3 boundary in §15 matches expected timeline and budget. Implementation (Phase 4 onward) does not begin until this and `ARCHITECTURE.md` are approved, per the governing Development Control Rule.
