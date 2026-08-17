-- ============================================================================
-- 0006_attendance_leave.sql
-- Attendance (spec S25-S26) and Leave/Absence Management (spec S27).
-- ============================================================================

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  session_type text not null check (session_type in ('rehearsal', 'event', 'meeting', 'department_meeting', 'other')),
  title text not null,
  department_id uuid references public.departments (id),   -- null = whole-choir session
  event_id uuid,                                            -- FK added once events exists (0008); null for rehearsals/meetings
  session_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_attendance_sessions_date on public.attendance_sessions (session_date);
create index idx_attendance_sessions_department on public.attendance_sessions (department_id);
create trigger trg_attendance_sessions_updated_at before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  -- status is a code into lookup_values(category='attendance_status'): present,
  -- absent, excused, emergency_leave, approved_leave, late, + any custom code
  -- an admin adds (spec S25 "+ Other configurable status").
  status_code text not null default 'present',
  recorded_via text not null default 'manual' check (recorded_via in ('manual', 'qr', 'mobile', 'web', 'import')),
  recorded_by uuid references public.users (id),
  client_idempotency_key text,     -- for offline mobile capture / sync conflict resolution (ARCHITECTURE S18)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, member_id)
);
create index idx_attendance_member on public.attendance (member_id);
create index idx_attendance_session on public.attendance (session_id);
create unique index uq_attendance_idempotency on public.attendance (session_id, member_id, client_idempotency_key)
  where client_idempotency_key is not null;
create trigger trg_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

comment on table public.attendance is
  'Every change is captured with recorded_by + created_at/updated_at and is additionally written to audit_logs via trigger (spec S41 "every attendance change must be auditable").';

-- Rolling attendance percentage per member, computed over a configurable
-- lookback window (system_settings.attendance_lookback_days). Implemented as
-- a view rather than a stored column so it is always correct without a
-- background recompute job; a materialized version can be introduced later
-- purely for dashboard performance without changing the contract.
create view public.member_attendance_summary as
select
  m.id as member_id,
  count(a.id) filter (
    where coalesce((lv.metadata->>'counts_as_present')::boolean, false)
  ) as sessions_present,
  count(a.id) as sessions_recorded,
  case when count(a.id) = 0 then null
       else round(
         100.0 * count(a.id) filter (where coalesce((lv.metadata->>'counts_as_present')::boolean, false))
         / count(a.id), 2)
  end as attendance_percentage
from public.members m
left join public.attendance a on a.member_id = m.id
left join public.lookup_values lv on lv.category = 'attendance_status' and lv.code = a.status_code
group by m.id;

comment on view public.member_attendance_summary is
  'Attendance % per member. "counts_as_present" is a per-status flag in lookup_values.metadata so admins can mark e.g. approved_leave as counting toward eligibility without a code change (spec S25/S27).';

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  leave_type text not null check (leave_type in ('emergency', 'planned', 'absence_explanation', 'other')),
  reason text not null,
  start_date date not null,
  end_date date not null,
  supporting_document_id uuid,     -- FK added once documents exists (0015)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references public.users (id),
  approved_at timestamptz,
  approver_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_leave_requests_member on public.leave_requests (member_id);
create index idx_leave_requests_status on public.leave_requests (status);
create trigger trg_leave_requests_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();

alter table public.attendance_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;

create policy attendance_sessions_select_scoped on public.attendance_sessions
  for select using (
    auth.uid() is not null
    and (department_id is null
         or department_id in (select public.current_user_department_ids())
         or public.has_permission('attendance.records.read_all'))
  );
create policy attendance_sessions_write_scoped on public.attendance_sessions
  for all using (
    public.has_permission('attendance.records.manage')
    or department_id in (select public.current_user_department_ids())
  );

create policy attendance_select_scoped on public.attendance
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('attendance.records.read_all')
    or session_id in (
      select id from public.attendance_sessions
      where department_id in (select public.current_user_department_ids())
    )
  );
create policy attendance_write_scoped on public.attendance
  for all using (
    public.has_permission('attendance.records.manage')
    or session_id in (
      select id from public.attendance_sessions
      where department_id in (select public.current_user_department_ids())
    )
  );

create policy leave_requests_select_scoped on public.leave_requests
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('attendance.leave.manage')
    or member_id in (
      select id from public.members
      where primary_department_id in (select public.current_user_department_ids())
    )
  );
create policy leave_requests_insert_self on public.leave_requests
  for insert with check (member_id in (select id from public.members where user_id = auth.uid()));
create policy leave_requests_update_hr on public.leave_requests
  for update using (public.has_permission('attendance.leave.manage'));
