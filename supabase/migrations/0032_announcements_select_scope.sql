-- ============================================================================
-- 0032_announcements_select_scope.sql
-- Phase 10.1 (Communications: Announcements). Fixes a genuine functional gap
-- found while building this phase's service layer, not a new feature.
--
-- THE GAP: `announcements_select_published` (0016) reads:
--   for select using (
--     auth.uid() is not null
--     and publish_at <= now()
--     and (expiry_at is null or expiry_at > now())
--   );
-- This has NO clause letting the author, or any `communications.
-- announcements.manage` holder, read a row outside its live publish/expiry
-- window. `publish_at` exists specifically so an announcement can be
-- SCHEDULED for a future date (spec S37/PRD §7.22's "publish/expiry date"),
-- but under the original policy, the moment a manager creates one with a
-- future `publish_at`, it becomes invisible to EVERYONE — including its own
-- author — until that moment arrives. `getAnnouncement` (list.ts) would
-- return null for the very row its own creator just inserted, and the
-- detail/edit page would immediately 404. This is not a hypothetical: it
-- reproduces on every single scheduled-for-later announcement, not an edge
-- case, so it is fixed here (narrowly) rather than only documented as an
-- open item the way 9.2's missing `finance.expenses.read` permission code
-- was (that gap needs a brand-new permission; this one only needs widening
-- an existing read policy's own OR-clauses).
--
-- THE FIX: add two OR-clauses — the row's own author, and anyone holding
-- `communications.announcements.manage` (the same permission the write
-- policy already requires) — may read a row regardless of its
-- publish/expiry window. The original "any signed-in user, only while
-- live" clause is preserved unchanged for every other reader.
-- ============================================================================

drop policy announcements_select_published on public.announcements;

create policy announcements_select_published on public.announcements
  for select using (
    auth.uid() is not null
    and (
      (publish_at <= now() and (expiry_at is null or expiry_at > now()))
      or author_id = auth.uid()
      or public.has_permission('communications.announcements.manage')
    )
  );
