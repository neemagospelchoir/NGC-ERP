# PHASE_10_2.md — Phase 10.2 Deliverable
## Neema Gospel Choir (NGC) ERP — Communication: Notifications

Continues Phase 10 (Communication) after 10.1 (Announcements). **10.2 Notifications** (this document) precedes 10.3 (Calendar) and 10.4 (Agenda & Voting).

## 1. Scope

In scope:
- **Notification templates** (`notification_templates`, PRD §7.21's "template library"): code/name/subject/body-with-placeholders/default channel, full CRUD.
- **A notification composer**: resolves an audience (`all` / `department` / `family` / `specific_users`) to a concrete recipient list and fans a single composed message out into one `notifications` row per recipient.
- **A personal "My notifications" inbox**: every signed-in user reads their own notifications and marks them read.
- **A CRITICAL bug found and fixed by this phase's own security review, before the original implementation ever shipped** — see §2.1.

Explicitly deferred to their own later sub-phase or out of scope, named here rather than silently skipped:
- **Calendar, Agenda & Voting** — 10.3/10.4, not part of this document.
- **Actual SMS/WhatsApp/push/email delivery** — see §2.2. Only the `in_app` channel is ever really "delivered" by this system today; every other channel is recorded `queued` and left there.
- **`event_participants`/`leadership` audiences** — no resolvable membership list exists for either in this codebase today (no canonical "who is participating in event X" table; no defined role-set for "leadership"), the same reasoning `announcements/status.ts` (10.1) already used to leave them out of that module's own audience picker.
- **Placeholder substitution** (`{{time}}` etc.) — templates store and display the literal placeholder syntax; no substitution engine exists yet. Named here as a real, visible gap rather than something quietly half-built.

## 2. Architecture

### 2.1 CRITICAL: the original `sendNotification` could only ever notify the sender — found and fixed before it shipped

The first implementation of `sendNotification` resolved an `all`/`department`/`family` audience by querying `users`/`members` through the caller's own RLS-scoped Supabase client, then bulk-inserted into `notifications` via `.insert(rows).select("*")`. Two RLS interactions combined to make this **non-functional for anyone other than `super_admin`**:

1. `users_select_self`/`members_select_scoped` RLS already narrows a caller who holds only `communications.notifications.send` — exactly what this phase's own seed correction (§2.3) grants `pro_spokesperson` — down to their OWN row. Resolving "every active user" or "everyone in department X" through that session returned, at most, the sender themselves.
2. Postgres requires every row an `INSERT ... RETURNING` returns to also satisfy the table's SELECT policy. `notifications_select_own` only allows `recipient_user_id = auth.uid() OR has_permission('communications.notifications.read_all')`. Since `pro_spokesperson` holds neither, the instant any row in the batch targeted someone other than the sender, the RETURNING clause violated RLS and Postgres **aborted the entire multi-row insert**, not just the offending row.

An independent adversarial security review (§4) found this by reasoning through the RLS text directly, then confirmed it live: acting as the actual seeded `pro_spokesperson` role (holding `communications.notifications.send` but not `.read_all`/`admin.users.read`/`members.profiles.read_all`), a plain multi-row `INSERT ... RETURNING` addressed to someone other than the sender raised `new row violates row-level security policy for table "notifications"` and the whole statement failed. **The one role PRD names as owning "Full Communications" could only ever successfully broadcast to itself.**

**The fix** is the same "narrow, purpose-built escape hatch" SECURITY DEFINER RPC pattern already used four times in this schema (Discipline's `apply_disciplinary_membership_status` 0026, `record_workflow_decision` 0028, `start_gate_pass_workflow` 0029, `start_expense_request_workflow` 0031) — extended a fifth time via **`send_notification` (migration 0033)**. It resolves the audience and performs the insert-with-RETURNING entirely inside a SECURITY DEFINER function body (immune to the caller's own RLS restrictions on `users`/`members`/`notifications`, since it executes as the function's owning role), gated on an explicit `has_permission('communications.notifications.send')` check evaluated once up front — the identical authorization `notifications_insert_service` RLS already required for a plain client-side insert, just checked inside the function instead of against every row of an ordinary session-scoped write.

**Re-verified independently, twice**: once by the original reviewer (who found the bug), and again by a second, independent review pass specifically tasked with re-deriving the fix from scratch rather than trusting the first review's summary. Both passes reproduced the same live-Postgres result: acting as the real `pro_spokesperson` role, calling the new RPC with `audience: 'all'` successfully creates rows for multiple OTHER users (not just the sender), a deactivated user is correctly excluded from `all`/`department`/`family` resolution, and a caller with no `communications.notifications.send` permission at all is refused. `send.ts` (the service layer) was rewritten to call `client.rpc("send_notification", ...)` — the client-side audience-resolution and insert logic that caused the bug no longer exists.

### 2.2 Only the `in_app` channel is ever actually delivered — every other channel is recorded, not sent

PRD §7.21/§36 and `docs/ARCHITECTURE.md` both explicitly name SMS and WhatsApp provider selection as an open **business** decision requiring a contractual relationship with a Tanzania-capable provider ("other channels can launch without it") — this environment has no such provider configured, and `email`/`push` face the identical gap (no transactional email/push provider is wired up either). Rather than invent a fake provider or leave a channel silently broken, `send_notification` marks `in_app` rows `status: 'sent'` immediately (inserting the row IS the delivery — an in-app inbox is nothing more than a filtered read of this same table) and leaves every other channel at `status: 'queued'`, exactly where the original 0016 schema's own `status` enum already anticipated a row could sit indefinitely pending a real dispatch mechanism. This is named explicitly here, not silently left as dead code a future reader might mistake for a bug.

### 2.3 A seed-grant correction: `pro_spokesperson` was missing `communications.notifications.send`

PRD §5's Role Summary names PRO/Spokesperson as owning "Full Communications + Announcements." The permission code (`communications.notifications.send`) already existed since Phase 4, but before this phase, only `super_admin` held it — the same shape of pre-existing seed-vs-PRD gap Phase 8.1 corrected for `logistics_officer`/`finance.vendors.manage` and Phase 9.1 corrected for `hr_deputy_secretary`/`finance.contributions.read`. Without this grant, the one role PRD explicitly names as owning Communications could manage templates and post announcements but could never actually send a notification through the composer this phase builds — confirmed and independently re-verified during the security review's live-Postgres testing (§2.1), which specifically exercised this exact role's actual grants rather than a synthetic superuser.

## 3. UI

- `/notifications` — **always visible**, the same "everyone has a real reason to be here" shape as Contributions/Expenses: `notifications_select_own` RLS lets any signed-in user read their own notifications. The composer is shown only to `communications.notifications.send` holders (Super Admin, PRO/Spokesperson per the corrected seed).
- `/notifications/templates`, `/notifications/templates/[id]` — gated on `communications.templates.manage`, the same "no self-service reader" shape as Vendors/Gate Passes (templates have no PRD-named individual-member use, unlike the inbox above) — `notification_templates_read_authenticated` RLS lets any signed-in user read template rows directly via REST regardless of this page-level gate, which controls only who reaches the management UI, the same "RLS grants read broadly, the page-level gate controls the management surface" pattern this codebase has used since Vendors (8.1).

## 4. Security review

Two independent adversarial review passes (Agent-dispatched, independent of the implementation and of each other) covered this phase. The first found the Critical bug described in §2.1 by reasoning through the exact RLS policy text and then reproducing it live against the real `pro_spokesperson` role. After the fix (0033 + the rewritten `send.ts`), a second, independent pass was dispatched specifically to re-derive and re-verify the fix from scratch — re-reading the migration's SQL for soundness (parameterization, `security definer` correctness, join/filter logic per audience branch), re-tracing `send.ts`'s RPC call shape, confirming `send.test.ts` was rewritten to stub the new RPC (not the old, removed client-side query logic) and that all tests pass, and independently re-executing the same four live-Postgres checks from a fresh transaction. Findings:

- **Critical, found and fixed**: `sendNotification`'s original client-side audience-resolution + `insert().select()` shape was non-functional for any non-`super_admin` sender (§2.1). Fixed via the `send_notification` SECURITY DEFINER RPC (0033); independently re-verified twice against live Postgres using the actual `pro_spokesperson` role and its actual grants.
- **Confirmed sound**: the RPC's `has_permission(...)` check runs before any data access; every table/function reference is schema-qualified (no SQL injection surface, no `search_path`-hijack foothold — `authenticated`/`anon` hold no `CREATE` privilege on `public` at all, confirmed by directly attempting to shadow a builtin as `authenticated` and getting `permission denied for schema public`); the `department`/`family` branches correctly join to `users` and filter `is_active`; a deactivated user is excluded from every audience except `specific_users` (deliberate — explicit addressing by ID is treated as overriding activity status, the same way `specific_users` targeting works everywhere else in this codebase).
- **Informational, not action-required, whole-schema pattern**: Postgres default-grants `EXECUTE` on a new function to `PUBLIC`, and 0024's `alter default privileges ... grant execute on functions to anon, authenticated` means `anon` ends up with `EXECUTE` on `send_notification` too — confirmed this is not unique to this function (all of 0026/0028/0029/0031 have the identical shape) and is not independently exploitable (the internal `has_permission(...)` check is NULL-safe and refuses `anon`, whose `auth.uid()` is always NULL, regardless of who can call the function at all) — the same "broad grants, permission-check-as-the-actual-gate" design 0024 itself documents for tables, applied consistently to functions too. An explicit `revoke ... from public` was tried and found insufficient on its own (0024's separate default-privilege rule still grants `anon` execute directly, not via the `PUBLIC` pseudo-role), so it was deliberately left out rather than shipping a revoke that wouldn't fully achieve its own stated goal — named here as a real, standing whole-schema item for whoever next hardens the SECURITY DEFINER RPC set (§7), not fixed function-by-function in this migration.
- **Informational**: `markNotificationReadAction` (the one server action with no try/catch in `actions.ts`) matches an existing precedent (`deleteAnnouncementAction`, 10.1) rather than introducing a new inconsistency — a thrown `ServiceError` becomes an uncaught Server Action exception instead of an inline message, a worse UX than the other forms on the same page but not a security issue (Next.js redacts the message in production).

## 5. Seed data changed this phase

`communications.notifications.send` added to `pro_spokesperson`'s existing grant in `supabase/seed/001_reference_data.sql` — see §2.3.

## 6. Validation performed

- `pnpm --filter @ngc/services typecheck` / `pnpm --filter @ngc/web typecheck` / `pnpm --filter @ngc/web lint` / `pnpm --filter @ngc/web build` all clean.
- 354/354 `@ngc/services` unit tests (339 pre-existing + 15 new: 9 `notifications/send.test.ts` — rewritten to stub the `send_notification` RPC after the Critical-bug fix, not the original broken client-side logic — 4 `notifications/templates.test.ts`, 2 `notifications/list.test.ts`).
- 63/63 Playwright e2e tests (61 pre-existing + 2 new `notifications.spec.ts` tests: a PRO/Spokesperson creating a template and sending a notification to a specific user, that user reading it in their inbox and marking it read, and a plain member confirmed to have an inbox but no composer/template-management affordances). The mock server (`mock-gotrue-server.mjs`) gained a `send_notification` RPC handler mirroring 0033's own audience-resolution/insert mechanics (minus the permission re-check, the established mock-vs-real-Postgres division of labor).
- **Manual `psql` verification against a live local Postgres instance, performed twice** (once finding the original bug, once independently re-verifying the fix from a fresh transaction): a plain member with no send permission is blocked from inserting directly; the real `pro_spokesperson` role's actual grants were confirmed (`send` yes, `read_all`/`admin.users.read`/`members.profiles.read_all` no); the new RPC, called from that exact role, successfully notifies multiple other real users and excludes a deactivated one; a no-permission caller is refused by the RPC with a clear error; the recipient can read and mark their own notification read; an unrelated third party can neither see nor update someone else's notification (0 rows both ways).
- Two independent adversarial security-review passes (Agent-dispatched) — findings in §4. The Critical finding was fixed and re-verified before this sub-phase was considered complete.

## 7. Open issues / deferred, not overlooked

- **No actual SMS/WhatsApp/push/email delivery** (§2.2) — a named, PRD-acknowledged business-decision dependency, not an oversight.
- **`event_participants`/`leadership` audiences are unselectable** — no resolvable membership list exists for either today.
- **No placeholder-substitution engine** — `bodyTemplate` displays literal `{{placeholders}}`.
- **`PUBLIC`/`anon` hold `EXECUTE` on every SECURITY DEFINER RPC in this schema** (§4), including this phase's new `send_notification` — not independently exploitable (the internal permission check is the real gate), but a real, standing, whole-schema hardening item for whoever next revisits the SECURITY DEFINER RPC set, spanning 0026/0028/0029/0031/0033, not something this phase's own narrow bug-fix scope re-litigates function-by-function.

Phase 10.2 (Notifications) is complete. Per the Development Control Rule's sub-phase continuation convention, work continues directly into 10.3 (Calendar) next without a fresh "proceed" instruction.
