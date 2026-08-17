-- ============================================================================
-- 0035_media_links_sharing_scope.sql
-- Phase 11 (Media). A genuine gap found while building this phase's own
-- service layer, fixed here rather than left as an inert set of columns.
--
-- THE GAP: `media_links` (0016) carries three columns that exist
-- specifically to let the Media Department distribute an item to a
-- targeted internal audience BEFORE general publication —
-- `shared_with_roles text[]`, `shared_with_department_ids uuid[]`,
-- `shared_with_member_ids uuid[]` — matching PRD §7.20's own description
-- verbatim: "photos, videos, press releases, coverage; SHARABLE TO SPECIFIC
-- MEMBERS/DEPARTMENTS/LEADERS/PARTICIPANTS." But the original RLS,
-- `media_links_select_scoped`, never referenced any of them:
--   for select using (is_published or public.has_permission('media.links.manage'));
-- With only those two branches, a row is either fully public (once
-- `is_published = true`, this policy has no `auth.uid() is not null`
-- guard either — see the "kept as-is" note below for why) or visible to
-- NOBODY except a `media.links.manage` holder. There is no state in
-- between, which means the specific-audience "share before you publish"
-- workflow PRD describes is not just unfinished UI — it is structurally
-- impossible under the original policy. A Media Department member setting
-- `shared_with_department_ids = [technical_department]` on an unpublished
-- clip would not actually grant that department anything; the columns are
-- write-only, never read by anything that gates access.
--
-- THE FIX: three additional OR-branches, each mirroring an eligibility
-- pattern already established elsewhere in this schema (0034's own
-- `eligible_voter_scope` checks) — a caller whose own role code appears in
-- `shared_with_roles`, whose own `members.primary_department_id` appears in
-- `shared_with_department_ids`, or whose own `members.id` appears in
-- `shared_with_member_ids` may now read a row regardless of `is_published`.
-- `shared_with_member_ids` stores `members.id` (not `auth.uid()`/`users.id`)
-- — consistent with this schema's own naming convention of "*_member_ids"
-- meaning a `members` row (see `event_participants.member_id`,
-- `contribution_records.member_id`), distinct from "*_user_ids" columns
-- elsewhere (`agendas.eligible_user_ids`, `announcements.target_user_ids`)
-- which store `auth.uid()`/`users.id` values instead.
--
-- KEPT AS-IS, DELIBERATELY: the original "any `is_published` row is fully
-- public, no `auth.uid() is not null` check" behavior is untouched. This
-- schema's `0024` grants `anon` the same base SELECT privilege as
-- `authenticated`, and ARCHITECTURE.md's own illustrative route tree names
-- a public, unauthenticated `/media` page — "Worship in Spirit" airs on
-- Crown TV and community outreach coverage is explicitly public-facing
-- content per PRD §1/§7.20, not internal-only. Requiring a session to read
-- a row the institution has already decided to publish would contradict
-- that public-marketing intent; only the SHARING (pre-publication,
-- targeted) path was actually broken, and that is what this migration
-- fixes.
-- ============================================================================

drop policy media_links_select_scoped on public.media_links;

create policy media_links_select_scoped on public.media_links
  for select using (
    is_published
    or public.has_permission('media.links.manage')
    or exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.revoked_at is null
        and r.code = any (media_links.shared_with_roles)
    )
    or exists (
      select 1 from public.members m
      where m.user_id = auth.uid()
        and m.primary_department_id = any (media_links.shared_with_department_ids)
    )
    or exists (
      select 1 from public.members m
      where m.user_id = auth.uid()
        and m.id = any (media_links.shared_with_member_ids)
    )
  );
