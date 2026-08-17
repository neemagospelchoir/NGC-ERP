# PHASE_11.md — Phase 11 Deliverable
## Neema Gospel Choir (NGC) ERP — Media

Phase 11 per `docs/ARCHITECTURE.md`'s numbered build order: "11. Media (Media links, Music, Playlists, Worship in Spirit, Event media)". Unlike Phases 7–10, this phase is **not decomposed into numbered sub-phases** — PRD has exactly one dedicated section for it (§7.20), the schema is a single table already shipped in Phase 4, and there is no further internal structure large enough to warrant splitting (mirroring Phase 6 Authentication's own precedent as a single, undivided phase).

## 1. Scope

In scope:
- **Media links** (`media_links`, PRD §7.20): per-event or standalone links (YouTube, Facebook, Instagram, TikTok, Google Drive, livestream, press release, other), with a publish flag and a pre-publication sharing scope (roles, departments, specific members). Full CRUD, gated on `media.links.manage`.
- **A genuine RLS gap found while building this phase's own service layer, fixed via migration 0035** — see §2.1.

Explicitly deferred to later phases or out of scope, named here rather than silently skipped:
- **"Music, Playlists"** — named in ARCHITECTURE's own one-line phase description, but PRD has no dedicated Music/Playlist section distinct from what Phase 8.4 (Technical Rider & Playlist) already built (`playlists`/`playlist_items`, song lists for a specific event's technical execution). Nothing further exists in PRD or the schema to build under that name here — treated as already delivered, not re-built or duplicated under Phase 11.
- **A public, unauthenticated `/media` marketing page** — ARCHITECTURE.md's own illustrative route tree names one (`(public)/ ... /media`), and this phase's own RLS fix (§2.1) deliberately keeps published rows readable without a session specifically so that page can exist later without any further schema change. Building the actual public-facing page/route is separate frontend work with its own design/copy needs, not part of this phase's ERP-module scope — the same "schema and RLS are ready, the page itself is a later phase's job" reasoning already used for Documents (0015) across 9.2/10.1/10.4.
- **Photo/video upload and storage** — PRD §7.20 mentions "photos, videos" alongside links; this table models everything as an external `url` (matching its own `link_type` values, all of which are external platforms/services) rather than a file upload — Supabase Storage integration is a cross-cutting concern (ARCHITECTURE §"File storage" already names a `media` bucket) not yet wired to any module by any phase, the same pre-existing gap named for `imageUrl`/`attachmentDocumentId` in Announcements (10.1) and `supportingDocumentId` in Expenses (9.2).
- **"Worship in Spirit" as a first-class content type** — `events.event_category` already includes `worship_in_spirit` as a value (shipped in Phase 7.5's own schema, 0008), and a Worship in Spirit event can already have `media_links` attached via the existing `event_id` FK — no new schema was needed. This phase does not add a dedicated Worship-in-Spirit filter/dashboard beyond that; a plain event-ID lookup is today's level of "support," matching the "build on existing schema, defer bespoke dashboards" pattern used throughout Phase 8–10.

## 2. Architecture

### 2.1 Gap found and fixed: the sharing-scope columns were completely inert

`media_links` (0016) carries three columns that exist specifically to let the Media Department distribute an item to a targeted internal audience before general publication — `shared_with_roles`, `shared_with_department_ids`, `shared_with_member_ids` — matching PRD §7.20's own description verbatim: *"sharable to specific members/departments/leaders/participants."* But the original `media_links_select_scoped` RLS never referenced any of them:
```sql
for select using (is_published or public.has_permission('media.links.manage'));
```
With only those two branches, a row is either fully public (once published) or visible to nobody except a `media.links.manage` holder — there is no state in between. Setting `shared_with_department_ids = [technical_department]` on an unpublished clip granted that department nothing; the columns were write-only, never read by anything that gates access. This made the specific-audience "share before you publish" workflow PRD describes structurally impossible, not just an unfinished UI.

**Fix (migration 0035)**: three additional OR-branches, each mirroring an eligibility pattern already established in this schema (0034's own `eligible_voter_scope` checks for Agenda & Voting) — a caller whose own role code appears in `shared_with_roles` (via a live, non-revoked `user_roles`/`roles` join), whose own `members.primary_department_id` appears in `shared_with_department_ids`, or whose own `members.id` appears in `shared_with_member_ids`, may now read a row regardless of `is_published`. `shared_with_member_ids` stores `members.id`, not `auth.uid()`/`users.id` — consistent with this schema's own naming convention (`event_participants.member_id`, `contribution_records.member_id`), distinct from the `*_user_ids` columns elsewhere (`agendas.eligible_user_ids`, `announcements.target_user_ids`) that store `auth.uid()` values instead.

**Kept as-is, deliberately**: a published row remains readable without any session at all — the original policy never required `auth.uid() is not null`, and this migration does not add that requirement. `0024_local_dev_role_grants.sql` already grants `anon` the same base table SELECT as `authenticated`, ARCHITECTURE.md's own illustrative route tree names a public `/media` page, and "Worship in Spirit" airs on Crown TV — published institutional media is public-facing content by design, not an accidental leak. Only the SHARING (pre-publication, targeted) path was actually broken, and that is what this migration fixes; publishing behavior is untouched.

**Manually verified against a live local Postgres instance** with real `authenticated`/`anon` role sessions: an outsider member (no role/department/member match) got zero rows querying an unpublished item shared with a specific department and role; the matching department's member got the row; a user holding the matching shared role got the row; a `media.links.manage` holder got it regardless; a true anonymous session got zero rows on the unpublished item and the full row once it was published. An independent adversarial security review additionally re-derived the SQL by hand — including the empty-array (`'{}'::uuid[]`) and NULL-handling cases for a row shared with nobody — and confirmed no operator-precedence error, no accidental widening, and no functional mismatch between what the service layer/UI ever write into `shared_with_member_ids` and what the RLS policy expects there.

### 2.2 `isPublished` defaults to `false` at every layer

The DB column default (0016), `createMediaLink`'s own default (`input.isPublished ?? false`), and the create form's checkbox (`defaultChecked={false}` when unset) all agree — there is no path by which a newly-created media link becomes public without an explicit, deliberate action at creation or edit time.

## 3. UI

- `/media` — **always visible**, the same "everyone has a real reason to be here" shape as Announcements/Calendar: any signed-in user (and, once published, even an anonymous visitor) can read a published item, matching PRD §6's "Choir Member: Read (published)" exactly. A non-manager's list-row title links straight to the external URL rather than to a detail page — there is nothing further for them to see on a separate page that isn't already on the list row. Creating a link is shown only to `media.links.manage` holders (Media Department, Super Admin per the seed).
- `/media/[id]` — gated entirely on `media.links.manage`, the same shape as Announcements' detail page — `media_links_write_media` RLS grants full CRUD to any holder of that permission, not just a row's own creator, so there is no legitimate "read but not manage" visitor to this specific page.

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) traced the actual RLS policy text in both `0016_communications.sql` and `0035_media_links_sharing_scope.sql`, re-derived the SQL boolean logic by hand (including the empty-array/NULL-handling edge case for a row shared with nobody), verified the `shared_with_member_ids` naming convention against the rest of the schema and the full write path (service layer + form), confirmed `isPublished` cannot default to `true` anywhere, and checked the write-side RLS trust model. Findings:

- **No issues found — ship.** The three new OR-branches are each correctly correlated to the current row (not a cross-row leak), correctly exclude revoked role grants, and correctly evaluate to `false` — not an error, not an accidental `true` — for a row shared with nobody (`'{}'::uuid[]`/`'{}'::text[]` defaults). The published-row public-exposure design was independently confirmed intentional and safe: nothing beyond the row's own already-published fields is exposed, and no accidental-publish path exists at the DB, service, or form layer.
- **Confirmed by design, not a gap**: `updateMediaLink`/`deleteMediaLink` add no ownership check beyond RLS, matching `media_links_write_media`'s own flat "any manage-permission holder, any row" shape — the same trust model as Vendors/Uniforms/Announcements' identical full-CRUD-by-permission-not-ownership design.
- **Informational, not action-required**: the department-sharing branch only matches a member's `primary_department_id`, not a secondary assignment recorded in `member_departments` — under-permissive (a legitimate secondary-department recipient might not see a shared item), not a security hole, and consistent with the identical scoping already used in 0034's own department-eligibility check for Agenda & Voting. Left as-is rather than introduced as a new, broader pattern in this one place.

## 5. Seed data changed this phase

None. `media.links.manage` and its grant to `media_department` (plus `events.invitations.read`, PRD's "read-only Events" for that role) were already present in `supabase/seed/001_reference_data.sql` since Phase 4, unused by any real caller until this phase.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` (workspace-wide) clean.
- 390/390 `@ngc/services` unit tests (376 pre-existing + 14 new across `media/{create,list,update}.test.ts`: default-unpublished creation, sharing-scope/event/title fields, URL validation, listing/filtering, sharing-scope mapping, publishing an existing draft, and a genuine hard delete).
- 69/69 Playwright e2e tests (67 pre-existing + 2 new `media.spec.ts` tests: a Media Department user creating, editing, and deleting a media link, and a plain member confirmed to see the always-visible nav link and a published item, but no create form or access to the manage-only detail page). This spec does not exercise 0035's own sharing-scope RLS widening — the mock enforces no RLS at all — that is covered by the live-Postgres manual verification below instead.
- **Manual `psql` verification of migration 0035 against a live local Postgres instance** — six checks, all passing: (1) an outsider gets zero rows on an unpublished, department-and-role-shared item; (2) the shared department's member gets the row; (3) the shared role's holder gets the row; (4) a `media.links.manage` holder gets it regardless; (5) a true anonymous session gets zero rows on the unpublished item; (6) that same anonymous session gets the row once published.
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings in §4; no bug required a fix before this phase was considered complete.

## 7. Open issues / deferred, not overlooked

- **"Music, Playlists"** from ARCHITECTURE's phase description — already delivered under Phase 8.4's Technical Rider & Playlist; not duplicated here (§1).
- **No public, unauthenticated `/media` marketing page** — the schema/RLS is ready for one (§2.1), but the actual page is separate frontend work, not built this phase.
- **No photo/video file upload** — everything is modeled as an external `url`; Supabase Storage integration remains unwired to any module, the same pre-existing gap named by Announcements (10.1) and Expenses (9.2).
- **No dedicated "Worship in Spirit" filter/dashboard** — the event category and the `event_id` linkage already exist; a bespoke view was not built this phase.
- **The department-sharing branch only matches a member's primary department**, not a secondary `member_departments` assignment — confirmed under-permissive, not a security gap (§4), and consistent with 0034's identical scoping choice.

Phase 11 (Media) is complete. Per the Development Control Rule, Phase 12 requires its own explicit "proceed" instruction before any further work begins.
