-- ============================================================================
-- 0037_playlists_sharing_and_event_participants_scope.sql
-- Phase 14.1 (QA). Two independent, previously-flagged read-scoping fixes.
-- ============================================================================

-- --- playlists.shared_with_roles: stored since 0009, never enforced ---
-- docs/PHASE_8_4.md §7 named this explicitly: "playlists.shared_with_roles
-- stored/editable but not enforced by playlists_select_scoped RLS — genuine
-- pre-existing gap." The column has been settable via the playlist form
-- since Phase 8.4 but had no effect on who could actually read a playlist.
-- Fixed by reusing the exact role-code-array-membership pattern Phase 11's
-- own security review already shipped for media_links.shared_with_roles
-- (0035) — this is purely additive (grants visibility to specified roles
-- that previously had none via this column; takes nothing away from the
-- existing event_participants-membership or technical.playlists.manage
-- branches).
drop policy if exists playlists_select_scoped on public.playlists;

create policy playlists_select_scoped on public.playlists
  for select using (
    auth.uid() is not null
    and (
      public.has_permission('technical.playlists.manage')
      or event_id in (
        select event_id from public.event_participants
        where member_id in (select id from public.members where user_id = auth.uid())
      )
      or exists (
        select 1 from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and ur.revoked_at is null
          and r.code = any (playlists.shared_with_roles)
      )
    )
  );

comment on column public.playlists.shared_with_roles is
  'Role codes this playlist is shared with, beyond participants/technical.playlists.manage — enforced by playlists_select_scoped since Phase 14.1 (0037); see 0035''s identical media_links.shared_with_roles pattern.';

-- --- event_participants: dead "or auth.uid() is not null" branch removed ---
-- docs/PHASE_12_3.md §7 flagged this: "event_participants_select_scoped RLS
-- is broader than any current caller needs — any signed-in user can read
-- any member's event assignments; flagged for tightening." Verified before
-- this fix (Phase 14.1's own research pass) that every existing caller
-- (listEventAssignmentsForMember on both web/mobile, listPlaylistsFor
-- Participant) already filters to the CALLER's own member_id — narrowing
-- this policy to "own row, or events.eligibility.manage" changes nothing
-- for any shipped feature, only closes the ability for an arbitrary
-- signed-in user to read another member's event-assignment rows directly.
drop policy if exists event_participants_select_scoped on public.event_participants;

create policy event_participants_select_scoped on public.event_participants
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('events.eligibility.manage')
  );
