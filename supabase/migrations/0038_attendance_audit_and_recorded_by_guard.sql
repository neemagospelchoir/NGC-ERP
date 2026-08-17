-- ============================================================================
-- 0038_attendance_audit_and_recorded_by_guard.sql
-- Phase 14.1 (QA). Fixes a real, pre-existing bug named in
-- docs/PHASE_12_2.md §7: `public.attendance`'s own table comment (0006)
-- claims "additionally written to audit_logs via trigger (spec S41)", but
-- 0021_audit_triggers.sql's actual trigger-attachment list never includes
-- `attendance` (or `attendance_sessions`) — confirmed by direct inspection
-- of every `create trigger audit_* ... on public.<table>` statement in this
-- schema. The only trigger ever attached to `attendance` is
-- `trg_attendance_updated_at`, a plain `set_updated_at()` timestamp
-- trigger, not an audit trigger. Every attendance record change (who
-- marked whom present/absent, and when) has been silently unaudited since
-- Phase 7.3, contrary to spec S41 and this table's own documented claim.
--
-- The same phase doc also names a second, related gap: `attendance.
-- recorded_by` is set by the service layer (`attendance/record.ts`,
-- `attendance/sync-offline.ts`) from a caller-supplied value with no
-- database-level check tying it to `auth.uid()` — every production caller
-- (web `attendance/actions.ts`, mobile `attendance/[id].tsx` +
-- `attendance-queue.ts`) already passes the signed-in user's own id, so
-- this is purely a missing defense-in-depth guard, not a behavior change
-- for any existing feature.
-- ============================================================================

create trigger audit_attendance after insert or update or delete on public.attendance
  for each row execute function public.write_audit_log();
create trigger audit_attendance_sessions after insert or update or delete on public.attendance_sessions
  for each row execute function public.write_audit_log();

comment on table public.attendance is
  'Every change is captured with recorded_by + created_at/updated_at and is additionally written to audit_logs via trigger (spec S41 "every attendance change must be auditable") — attendance itself has been audited since Phase 14.1 (0038); it was, contrary to this comment, NOT actually attached to the audit-trigger list from Phase 7.3 through Phase 13.2 (see 0038''s file header).';

drop policy if exists attendance_write_scoped on public.attendance;

create policy attendance_write_scoped on public.attendance
  for all
  using (
    public.has_permission('attendance.records.manage')
    or session_id in (
      select id from public.attendance_sessions
      where department_id in (select public.current_user_department_ids())
    )
  )
  with check (
    recorded_by = auth.uid()
    and (
      public.has_permission('attendance.records.manage')
      or session_id in (
        select id from public.attendance_sessions
        where department_id in (select public.current_user_department_ids())
      )
    )
  );
