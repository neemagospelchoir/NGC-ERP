-- ============================================================================
-- 0008_invitations_events.sql
-- Invitation / Event Management (spec S19-S24, S39-S41). An approved
-- invitation instantiates exactly one event (ARCHITECTURE S6.1); every
-- downstream artifact (technical rider, gate pass, logistics, media,
-- attendance) threads off that one event record.
-- ============================================================================

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  invitation_number text not null unique,   -- INV-2026-0001

  -- External organizer submission (spec S19). No login; submitted via a
  -- service-role-backed public endpoint after validation (ARCHITECTURE S5.1
  -- applies here the same way it does to applications).
  organizer_name text not null,
  organizer_contact_email citext,
  organizer_contact_phone text,
  organization_name text,

  event_name text not null,
  event_type text,                        -- lookup_values('event_type')
  proposed_date date not null,
  proposed_time time,
  venue text,
  location text,
  region text,
  expected_audience int,
  nature_of_invitation text,
  performance_requirements text,
  technical_requirements text,
  transport_requirements text,
  accommodation_requirements text,
  financial_information text,
  additional_notes text,

  access_token_hash text not null,        -- organizer status-check token, hashed
  verification_contact text not null,

  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'received', 'under_review', 'pending_information',
    'pending_management_approval', 'approved', 'declined', 'cancelled',
    'completed', 'postponed'
  )),

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_invitations_status on public.invitations (status);
create index idx_invitations_date on public.invitations (proposed_date);
create trigger trg_invitations_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid unique references public.invitations (id), -- null for purely-internal events (rehearsal series aside; those use attendance_sessions, not events)
  name text not null,
  event_category text not null default 'invitation'
    check (event_category in ('invitation', 'worship_in_spirit', 'internal_performance', 'community_outreach', 'other')),
  event_date date not null,
  start_time time,
  end_time time,
  venue text,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'postponed')),
  qr_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_events_date on public.events (event_date);
create index idx_events_status on public.events (status);
create trigger trg_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.attendance_sessions
  add constraint fk_attendance_sessions_event foreign key (event_id) references public.events (id);

-- Business-level requirements captured from the invitation/organizer,
-- distinct from the Technical Department's operational realization of them
-- (technical_riders, 0010) — see ARCHITECTURE S6.2 rationale.
create table public.event_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  requirement_type text not null check (requirement_type in ('technical', 'transport', 'accommodation', 'financial', 'other')),
  description text not null,
  created_at timestamptz not null default now()
);
create index idx_event_requirements_event on public.event_requirements (event_id);

-- Members formally assigned/invited to participate in a specific event
-- (distinct from event_attendance, which is the actual on-the-day record).
create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  assignment_source text not null default 'manual' check (assignment_source in ('manual', 'eligibility_recommended', 'eligibility_override')),
  override_reason text,          -- mandatory when a manager overrides the eligibility recommendation (spec S26)
  overridden_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);
create index idx_event_participants_event on public.event_participants (event_id);
create index idx_event_participants_member on public.event_participants (member_id);

create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  status_code text not null default 'present',   -- lookup_values('attendance_status'), same registry as rehearsal attendance
  recorded_via text not null default 'manual' check (recorded_via in ('manual', 'qr', 'mobile', 'web', 'officer')),
  recorded_by uuid references public.users (id),
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);
create index idx_event_attendance_event on public.event_attendance (event_id);
create trigger trg_event_attendance_updated_at before update on public.event_attendance
  for each row execute function public.set_updated_at();

alter table public.invitations enable row level security;
alter table public.events enable row level security;
alter table public.event_requirements enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_attendance enable row level security;

-- No public/anon SELECT policy on invitations: external status checks go
-- through a service-role-backed endpoint that verifies invitation_number +
-- verification_contact server-side and returns only the public-safe status
-- projection (spec S20 "do not expose confidential internal information"),
-- never a direct table read.
create policy invitations_select_internal on public.invitations
  for select using (auth.uid() is not null);
create policy invitations_write_scoped on public.invitations
  for all using (public.has_permission('events.invitations.manage'));

create policy events_select_internal on public.events
  for select using (auth.uid() is not null);
create policy events_write_scoped on public.events
  for all using (public.has_permission('events.invitations.manage') or public.has_permission('technical.events.manage'));

create policy event_requirements_select_internal on public.event_requirements
  for select using (auth.uid() is not null);
create policy event_requirements_write_scoped on public.event_requirements
  for all using (public.has_permission('events.invitations.manage') or public.has_permission('technical.events.manage'));

create policy event_participants_select_scoped on public.event_participants
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or auth.uid() is not null
  );
create policy event_participants_write_scoped on public.event_participants
  for all using (public.has_permission('events.eligibility.manage'));

create policy event_attendance_select_scoped on public.event_attendance
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('attendance.records.read_all')
  );
create policy event_attendance_write_scoped on public.event_attendance
  for all using (public.has_permission('attendance.records.manage'));
