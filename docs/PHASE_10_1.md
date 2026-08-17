# PHASE_10_1.md — Phase 10.1 Deliverable
## Neema Gospel Choir (NGC) ERP — Communication: Announcements

Begins Phase 10 (Communication), the phase after Phase 9 (Finance): per `docs/ARCHITECTURE.md`'s numbered build order (§ "Phased build order"), Phase 10 covers Announcements, Notifications, SMS, WhatsApp, Email, Calendar, and Voting. This phase decomposes the same way Phase 8/9 did, into named sub-phases built one after another under the same continuation authorization: **10.1 Announcements** (this document), 10.2 Notifications, 10.3 Calendar, 10.4 Agenda & Voting.

## 1. Scope

In scope:
- **Announcements** (`announcements`, PRD §7.22): title/message/image/attachment, a `target_audience` descriptor (informational only — see §2.2), priority, publish/expiry scheduling, and full CRUD.
- **A narrowly-scoped RLS fix** (0032) for a genuine bug found while building this phase's own service layer — see §2.1.

Explicitly deferred to their own later sub-phase or out of scope, named here rather than silently skipped:
- **Notifications, SMS/WhatsApp/Email channels, Calendar, Agenda & Voting** — 10.2/10.3/10.4, not part of this document.
- **A department-scoped write policy letting a Department Leader create "own dept." announcements** (PRD §6's Permission Matrix names this entitlement) — today, `announcements_write_scoped` RLS (0016) gates ALL writes on the flat `communications.announcements.manage` permission alone, which Department Leaders (a scope-based role with no global permission row per the seed's own documented convention) do not and structurally cannot hold. Closing this needs a genuinely new, department-scope-aware RLS policy (mirroring Attendance's `current_user_department_ids()` pattern), not a seed-grant correction — left as a named open item (§7), the same class of deliberate non-fix as 9.2's missing `finance.expenses.read` for HR.
- **A member/department/family/event picker with name search** — plain paste-the-id fields, the established simplification.
- **Rendering `imageUrl`/`attachmentDocumentId` as an actual image/attachment** — both are stored and editable, but the Documents module (0015) still has no service layer or UI built by any phase (the same pre-existing gap Expenses' `supportingDocumentId` already named in 9.2), so there is nothing yet to render an attachment against or fetch an image through; `imageUrl` is stored as a plain string field today, not wired to an `<img>` tag.

## 2. Architecture

### 2.1 A real, reproducible bug found and fixed: `announcements_select_published` blocked an author from ever reading back their own scheduled announcement

`publish_at` exists specifically so an announcement can be scheduled for a future date (PRD §7.22's "publish/expiry date"). But the original RLS policy (0016) read:
```sql
for select using (
  auth.uid() is not null
  and publish_at <= now()
  and (expiry_at is null or expiry_at > now())
);
```
This has no clause letting the author, or any manager, read a row outside its live window. The instant a manager created an announcement with a future `publish_at`, it became invisible to **everyone, including its own author**, until that moment arrived — `getAnnouncement` would return `null` for the very row its own creator just inserted, and the edit page would 404 immediately. This is not an edge case; it reproduces on every single scheduled-for-later announcement, which is a named, intentional feature of this table (the `publish_at`/`expiry_at` columns exist for exactly this). Migration **0032** fixes it by widening the policy with two additional OR-clauses — the row's own `author_id = auth.uid()`, and anyone holding `communications.announcements.manage` (the same permission the write policy already requires) — while leaving the original "any signed-in user, only while live" clause untouched for every other reader.

**Manually verified against a live local Postgres instance** (not just unit/e2e tests, neither of which executes real RLS policies): four checks, all passing — (1) the author of a future-dated announcement can read it back; (2) an unrelated plain member cannot; (3) a `communications.announcements.manage` holder (a `pro_spokesperson`-role test user) can, regardless of authorship; (4) once flipped to a past `publish_at`, the plain member can now see it too, confirming the original live-window behavior is fully preserved for ordinary readers. An independent adversarial security review (§4) additionally re-derived the policy's boolean parenthesization by hand and confirmed no operator-precedence widening slipped in for non-author/non-manager callers.

### 2.2 `target_audience`/`target_department_id`/`target_family_id`/`target_user_ids` are informational only, not an access-control filter — unchanged from 0016, worth stating explicitly

Neither the original 0016 RLS nor 0032's widening ever reference these columns in a `select` policy. Read access is governed purely by the live-window-or-author-or-manager rule above; the audience fields describe who an announcement is *intended for*, they do not *restrict* who can see it — the same "any signed-in user reads everything" transparency baseline this codebase has used since Invitations (7.5) for tables with no per-row confidentiality requirement. The UI (`announcement-form.tsx`) is written to avoid implying otherwise: field hints describe audience as descriptive ("used when audience is a specific department"), not as a visibility promise. `event_participants` and `leadership` are valid `target_audience` database values (the check constraint allows them) but are deliberately left out of the UI's Select options (`status.ts`) — neither has a resolvable membership list in this codebase today (no canonical "who is participating in event X" table, and "leadership" has no defined role-set), so offering them would create a selectable option that silently means nothing, the same reasoning 9.3 used to leave `event_participants`/`family` targeting out of Procurement's own scope where they lacked a concrete resolution path.

## 3. UI

- `/announcements` — **always visible**, the same "everyone has a real reason to be here" shape as Uniforms/Technical Riders/Contributions: `announcements_select_published` RLS lets any signed-in user read every currently-live announcement, matching PRD §6's "Choir Member: Read" exactly. The create form is shown only to `communications.announcements.manage` holders (Super Admin, HR/Deputy Secretary, PRO/Spokesperson per the seed).
- `/announcements/[id]` — gated on `communications.announcements.manage` (not ownership — the permission itself is full CRUD per `announcements_write_scoped`, so any holder may edit/delete any announcement, matching that policy's own `for all` shape exactly, not a narrower "only your own" rule). A non-holder sees an explicit "you don't have permission" message, the same shape as Gate Pass's/Procurement's detail pages (chosen over Expenses'/Leave's RLS-returns-null-so-404 shape because a manage-permission holder's own read access is never row-scoped here — there is no legitimate "read but not manage" reader of this page at all, unlike Expenses' self-service owner).

## 4. Security review

An adversarial review (Agent-dispatched, independent of the implementation) covered the new migration (0032), the full service layer, UI/actions, the new nav item, and the e2e spec, with special attention to two risks specific to this phase's own change: (1) whether 0032's added OR-clauses were correctly parenthesized (an operator-precedence mistake here could have accidentally widened read access for ordinary callers), and (2) whether `authorId` could be forged by a client, which combined with 0032's new author-can-always-read clause would let a non-privileged caller impersonate authorship to read someone else's draft/scheduled announcement. Findings:

- **No new bugs found.** The 0032 policy's three OR-branches are already fully parenthesized as a single group AND-ed with `auth.uid() is not null`; for a caller who is neither the author nor a manage-permission holder, the expression reduces exactly to the original live-window clause — no widening. `authorId` is resolved exclusively from `auth.getCurrentUserWithRoles(supabase).id` inside `createAnnouncementAction` (the only call site of `createAnnouncement` in the app) and is never read from `formData`; `updateAnnouncement`'s input type omits `authorId` entirely, so authorship cannot be reassigned after creation either. The theoretical exploit is not reachable.
- **Confirmed by design, not a gap**: `updateAnnouncement`/`deleteAnnouncement` have no re-read-before-write status guard, unlike Expenses/Procurement — correctly so, since `announcements` has no workflow/status field to bypass; RLS's flat permission gate is the only, and sufficient, write boundary here, the same shape as Vendors' own flat-CRUD precedent.
- **Confirmed no XSS/IDOR**: every rendered field goes through plain JSX interpolation (no `dangerouslySetInnerHTML` anywhere in the module); `imageUrl` is stored but not yet rendered as an `<img src>` by any page, so it isn't a live injection vector today; IDs are `gen_random_uuid()`-based and RLS-gated regardless of guessability.
- **Informational, not action-required**: the PRD §6 Permission Matrix's "Announcements" row is more granular (HR: Create only; Department Leader: Create own-dept.) than the seed's actual single `communications.announcements.manage` permission (full CRUD, granted to HR and PRO alike) — PRD itself calls this matrix "representative," and the Department-Leader gap is separately named in §1/§7 as a deliberate non-fix, not something newly discovered and hidden.

## 5. Seed data changed this phase

None. `communications.announcements.manage` and its grants to `hr_deputy_secretary`/`pro_spokesperson` were already present in `supabase/seed/001_reference_data.sql` since Phase 4, unused by any real caller until this phase.

## 6. Validation performed

- `pnpm --filter @ngc/services typecheck` / `pnpm --filter @ngc/web typecheck` / `pnpm --filter @ngc/web lint` / `pnpm --filter @ngc/web build` all clean.
- 339/339 `@ngc/services` unit tests (331 pre-existing + 8 new: 5 `announcements/create.test.ts`, 3 `announcements/update.test.ts`).
- 61/61 Playwright e2e tests (59 pre-existing + 2 new `announcements.spec.ts` tests: a PRO/Spokesperson posting, editing, and deleting an announcement, and a plain member confirmed to see the always-visible nav link and read what's posted with no management controls shown or reachable).
- **Manual `psql` verification of 0032 against a live local Postgres instance** — four checks, all passing: the author of a future-dated announcement can read it back; an unrelated plain member cannot; a `communications.announcements.manage` holder can, regardless of authorship; and once live, the plain member can see it too (original behavior preserved).
- An adversarial security-review pass (Agent-dispatched, independent of the implementation) — findings in §4; no bug required a fix before this sub-phase was considered complete.

## 7. Open issues / deferred, not overlooked

- **No department-scope-aware write RLS for Department Leaders' PRD-named "Create (own dept.)" entitlement** (§1) — writes are gated on the flat `communications.announcements.manage` permission alone; closing this needs a new scoped RLS policy, not a seed-grant correction, and is left as a named gap the same way 9.2 left HR's missing `finance.expenses.read` permission code.
- **No member/department/family/event picker with name search** — plain-text ID entry today, matching every prior module's identical deferral.
- **`imageUrl`/`attachmentDocumentId` are stored but not yet rendered** as an actual image/attachment — the Documents module (0015) still has no service layer or UI built by any phase; revisit once it exists.
- **`event_participants`/`leadership` `target_audience` values are unselectable in the UI** (§2.2) — no resolvable membership list exists for either today.

Phase 10.1 (Announcements) is complete. Per the Development Control Rule's sub-phase continuation convention (established across Phase 8/9), work continues directly into 10.2 (Notifications) next without a fresh "proceed" instruction; Phase 11 will require its own explicit "proceed" once all of Phase 10 is complete.
