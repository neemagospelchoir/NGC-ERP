# PHASE_8_4.md — Phase 8.4 Deliverable
## Neema Gospel Choir (NGC) ERP — Operations: Technical Rider & Playlist

Continuation of the Development Control Rule sequence and of Phase 8's decomposition (docs/PHASE_8_1.md's introduction). **8.4 Technical Rider & Playlist** (this document) follows 8.1 (Vendors + Inventory/Assets), 8.2 (Uniform Management), and 8.3 (Gate Pass). Remaining: 8.5 Logistics.

## 1. Scope

In scope:
- **Technical Rider** (`technical_riders`, PRD §7.9): one rider per event (`event_id unique`, 0009) covering PA, lighting, LED display, camera, recording, power, stage, and monitoring requirements, crew notes, setup/soundcheck time, and general technical notes. Create-or-edit is a single insert-or-update action (`upsertTechnicalRider`) — there is no separate "create" vs. "edit" service call, since the table's own uniqueness constraint makes them the same operation.
- **Playlist** (`playlists`/`playlist_items`, PRD §7.9): one playlist per event (`event_id unique`), with any number of ordered song entries (`unique (playlist_id, sequence_number)`) recording song title, key, duration, lead/backing vocal member IDs, instrument, and technical notes. Full CRUD on both the playlist record (title only — see below) and its items (add/edit/remove).
- **A genuinely new read-scoping pattern**: `playlists_select_scoped` RLS (0009) is the first RLS policy in Phase 8 that scopes a non-manager's read to "events I actually participate in" rather than either a flat permission gate (Vendors/Assets/Gate Passes) or a flat "any signed-in user"/"my own records" shape (Uniforms/Technical Riders). `listPlaylistsForParticipant` (new, §2.2) makes this explicit at the application layer rather than relying solely on RLS.
- **The first hard-delete feature in this codebase**: `removePlaylistItem` issues a real `DELETE` (§2.3) — every prior module (Discipline, Assets, Uniforms, Gate Passes) either never deletes rows or has an explicit "never deleted" design principle (spec S33). Playlist items have no such requirement; removing a song that was added by mistake, or cut from the set list, is a normal editorial action with no audit-trail expectation, matching the schema (no soft-delete column on `playlist_items`).

Explicitly deferred, named here rather than silently skipped:
- **A member/event picker with name search** — `eventId` (rider/playlist creation) and `leadVocalMemberId`/`backingVocalMemberIds` (playlist items) are plain pasted-ID fields, the same deliberate simplification as every prior Phase 8 module (docs/PHASE_8_1.md §1, docs/PHASE_8_3.md §1).
- **Auto-generating a rider from an approved invitation** — PRD §7.9 says "Auto-generatable Technical Rider per approved invitation"; this phase builds the rider as a standalone record a Technical Manager fills in directly, not one seeded automatically from `invitations`/`events` data. No prior Phase 8 module has built any auto-generation-from-another-record flow yet, and inventing one here, unscoped, seemed riskier than naming it as deferred.
- **Sharing a playlist with other roles in a way RLS actually enforces** — `playlists.shared_with_roles` (a `text[]` column) is stored, editable via the UI, and displayed, but `playlists_select_scoped` RLS does not check it at all (only `technical.playlists.manage` OR event-participant membership). This is a genuine pre-existing schema/RLS gap from Phase 4, not introduced this phase — see §2.4/§7.
- **A `technical_rider_items` line-items table linking the rider to Inventory categories** — 0009's own header comment describes this as a planned future addition once Inventory (0010) existed, but no later migration ever created it. The rider stays the free-text-fields-only shape the schema actually has today; inventing the table would be schema work well beyond "build a service+UI layer on existing schema," this phase's established scope (docs/PHASE_8_1.md's introduction).
- **8.5's Logistics/Trips** — unrelated tables, named in docs/PHASE_8_1.md's introduction.

## 2. Architecture

### 2.1 One insert-or-update action, not separate create/edit calls

`upsertTechnicalRider` (`packages/services/src/technical-riders/upsert.ts`) checks for an existing row by `event_id` first, then inserts or updates — the same check-then-write shape as `recordAttendance` (Phase 7.3), rather than a single `.upsert()` call, matching this codebase's established preference for explicit multi-step writes. The same UI form (`TechnicalRiderForm`) and the same underlying service call serve both `/technical-riders` (create, `eventId` field shown) and `/technical-riders/[id]` (edit, `eventId` fixed and bound server-side) — the only difference between `createTechnicalRiderAction` and `updateTechnicalRiderAction` (`apps/web/app/(erp)/technical-riders/actions.ts`) is which paths they revalidate afterward.

Playlists are NOT built the same way: `playlists.event_id unique` is also a one-per-event constraint, but a playlist is a container for many ordered items that get added/edited/removed independently over time, not a single form's worth of fields replaced wholesale — so `createPlaylist` is a plain, one-time insert (checked first, for a friendly "this event already has a playlist" message), and everything afterward goes through `updatePlaylist` (title/`shared_with_roles` only) and the separate `items.ts` CRUD.

### 2.2 `listPlaylistsForParticipant` — application-level defense-in-depth, and what made this testable at all

`playlists_select_scoped` RLS already narrows a non-manager's `select *` on `playlists` down to rows for events they participate in (via `event_participants`). The list page (`/playlists`) could have simply called the same unscoped `listPlaylists()` for every caller and trusted RLS to do the filtering — but `apps/web/e2e/mock-gotrue-server.mjs` does not replicate RLS at all (its own header doc comment states this explicitly), so a first pass at this page's e2e test failed: an outsider member who should see zero playlists instead saw the one seeded playlist, because the mock's generic `GET /rest/v1/playlists` returns every row regardless of caller.

Rather than treating this as "untestable, skip it," `listPlaylistsForParticipant` (`packages/services/src/playlists/list.ts`) was added as an explicit, application-level query: it looks up the caller's own `event_participants` rows (scoped by their own `member_id`, never client-supplied), then queries `playlists` with `.in("event_id", eventIds)`. `/playlists/page.tsx` calls this for any caller without `technical.playlists.manage`, and the full `listPlaylists()` for a manager. This is genuine defense-in-depth, not a workaround for a test gap — the same "belt and suspenders" reasoning as `listAssignmentsForMember` (Phase 8.2) — and it happens to be what makes the participant-scoping behavior possible to exercise end-to-end at all, since RLS itself is invisible to this mock.

### 2.3 The first hard DELETE in this codebase — and a real gap it surfaced in the e2e mock

`removePlaylistItem` is this codebase's first-ever `.delete()` call from the service layer. Every previous write path only ever inserted or updated rows. This meant `apps/web/e2e/mock-gotrue-server.mjs` had no `DELETE` handler at all — the generic REST dispatcher only implemented `GET`/`POST`/`PATCH` — and the first e2e run against it failed with a 501 `unmocked_gotrue_endpoint` response. A generic `DELETE` handler was added, mirroring the existing `PATCH` handler's shape (match rows via the shared `queryTable` filter logic, then remove them from `dataset[table]`), with the same documented scope as every other generic handler here: it does not replicate `ON DELETE CASCADE` or RLS, only the real Next.js request/response wiring.

### 2.4 `shared_with_roles` is displayed and editable, but deliberately not treated as an access control

`UpdatePlaylistInput.sharedWithRoles`'s own doc comment (`packages/services/src/playlists/types.ts`) and `EditPlaylistForm`'s hint text both say plainly that this field is stored but not enforced by RLS. The `[id]/page.tsx` detail page only ever displays it as read-only information to a non-manager viewer (someone who already passed `playlists_select_scoped` some other way — manage permission or event participation) — it is never used anywhere in this phase's code as a gate on anything. This is a pre-existing Phase 4 schema/RLS gap, not something this phase introduced or attempted to silently close; see §7.

## 3. UI

- `/technical-riders` and `/playlists` — both **always visible** in the nav (new "Technical" nav group), unlike Vendors/Assets/Gate Passes. `technical_riders_select_internal` RLS lets any signed-in user read every rider outright; `playlists_select_scoped` legitimately scopes a non-manager down to their own participated-in events (§2.2) — both are the same "everyone has a real reason to be here" shape as Uniforms/Attendance & Leave, not a gated management tool.
- `/technical-riders/[id]` — an editable form for a manager, a read-only field list for anyone else (RLS already allows the read; there is no separate "you don't have permission" branch to write, unlike Gate Passes, since RLS's own row-visibility rule already matches the intended access boundary — see the page's own doc comment).
- `/playlists/[id]` — read access is `notFound()` for anyone RLS denies (query returns null, page 404s) rather than an explicit "no permission" message, since `playlists_select_scoped`'s row-visibility already matches the page's intended shape exactly. Song add/edit/remove forms are gated on `technical.playlists.manage`; a participant with no manage permission sees the song list read-only.
- Both list/detail pages needed a dedicated client "table" component (`TechnicalRidersTable`, `PlaylistsTable`) rather than building `columns` (which carry `render` functions) directly in the Server Component page — the first build attempt failed at runtime with "Functions cannot be passed directly to Client Components," caught immediately by this phase's own e2e run, and fixed by mirroring `GatePassTable`/`UniformsTable`'s existing shape (docs/PHASE_8_1.md, docs/PHASE_8_2.md).

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covered: whether any write path trusts a client-supplied value for identity/authorization (`preparedBy`/`createdBy` are both derived server-side from the session in every case — no); whether `updatePlaylistItem`/`removePlaylistItem` verify an item actually belongs to the claimed playlist (they don't — see below); TOCTOU races in the check-then-write patterns; whether `shared_with_roles` is handled honestly given it does nothing security-relevant (yes — see §2.4); whether `listPlaylistsForParticipant` could leak another member's events (no — scoped by the caller's own `member_id`, server-derived); whether any page-level check could be bypassed to reach a write action (no — every write re-enforces via RLS on the session-bound client regardless of what the page rendered); and whether the new mock DELETE handler has any cross-table risk (no — it's the same per-table, per-request dispatch as every other generic handler). No Critical/High findings. Two Low findings, both accepted as documented limitations:

- **`updatePlaylistItem`/`removePlaylistItem` take only `itemId`, not `playlistId`** — they don't verify the item belongs to the playlist the caller's page implies. Confirmed NOT a privilege boundary: `playlist_items_write_technical` RLS gates writes on the *global* `technical.playlists.manage` permission, not a per-playlist scope, so anyone who can call this at all already has table-wide write access; a mismatched ID pair only mislabels which page gets `revalidatePath`'d. Documented in `items.ts`'s own comment rather than adding a redundant ownership check for a boundary RLS doesn't draw.
- **TOCTOU race in `upsertTechnicalRider`/`createPlaylist`'s check-then-write** — under a genuine race, the DB's own `unique(event_id)` constraint prevents a duplicate row; the losing caller just gets a generic error message rather than a specifically-worded conflict message (only `addPlaylistItem`/`updatePlaylistItem` special-case Postgres's `23505`). Data integrity is preserved by the constraint regardless; this is a UX rough edge, not a security or correctness bug, matching this codebase's established practice of accepting this exact class of race (docs/PHASE_8_1.md §2.3, docs/PHASE_8_3.md §4).

## 5. Seed data changed this phase

None — `technical.riders.manage`/`technical.playlists.manage` permissions and their grant to `technical_manager` were already present in `supabase/seed/001_reference_data.sql` since Phase 4, unused until this phase gave them a real caller.

## 6. Validation performed

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across every workspace package.
- 268/268 `@ngc/services` unit tests (250 pre-existing + 18 new: 3 `technical-riders/upsert.test.ts`, and 15 across `playlists/create.test.ts`, `update.test.ts`, `items.test.ts`, `list.test.ts`).
- 52/52 Playwright e2e tests (50 pre-existing + 2 new `technical-riders-playlists.spec.ts` tests: a Technical Manager creating and editing a rider with a plain member confirmed able to still read it, and a Technical Manager creating a playlist, adding/editing/removing a song, with participation-based read scoping confirmed for both a participant member and an outsider).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings and resolution in §4.

## 7. Open issues / deferred, not overlooked

- No member/event picker with name search — plain-text ID entry today (§1).
- No auto-generation of a rider from an approved invitation (§1) — PRD §7.9 names this; built as a standalone manually-filled record instead.
- No `technical_rider_items` line-items table linking the rider to Inventory categories (§1) — 0009's own header comment names this as a planned-but-never-built addition; not invented this phase.
- **`playlists.shared_with_roles` is stored and editable but not enforced by `playlists_select_scoped` RLS** (§2.4) — a genuine, pre-existing Phase 4 gap, not introduced or silently closed this phase. Whoever revisits Playlists' RLS next should either make this column do something (extend the policy to check the caller's role codes against it) or remove it, rather than leave an administrator-facing field that visibly does nothing.
- The itemId/playlistId mismatch in `updatePlaylistItem`/`removePlaylistItem` (§4) — documented, not fixed; not a privilege boundary today.
- The TOCTOU race in `upsertTechnicalRider`/`createPlaylist` (§4) — documented, not fixed; low real-world severity.
- 8.5 (Logistics) remains — the user's single "proceed to 8.3, 8.4, and 8.5" instruction covers building all three before pausing again.
