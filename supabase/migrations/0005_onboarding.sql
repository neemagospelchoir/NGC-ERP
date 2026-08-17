-- ============================================================================
-- 0005_onboarding.sql
-- Applications (new-member onboarding, spec S7-S9, S42-S43), application
-- documents, member information-update requests (spec S8), and Probation
-- (spec S10). Applications are retained permanently even after conversion to
-- a member (never destroyed), linked one-directionally via member_id.
-- ============================================================================

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique,   -- APP-2026-0001, server-generated
  application_type text not null default 'new_member' check (application_type in ('new_member', 'information_update')),

  -- Token-based access for the applicant (no full Supabase Auth account,
  -- per ARCHITECTURE S5.1). access_token_hash stores a hash, never the raw
  -- token; verification_contact is the secondary factor (email or phone)
  -- the applicant must supply alongside application_number + token.
  access_token_hash text not null,
  verification_contact text not null,

  -- For information_update applications, this points at the existing member
  -- being updated; null for brand-new applicants.
  existing_member_id uuid references public.members (id),

  -- Snapshot of submitted data. Kept as JSONB rather than 40+ individual
  -- columns because (a) the form is long and evolves, (b) versioned
  -- information-update requests need a clean before/after diff, and (c) only
  -- approved applications get promoted into the strongly-typed members /
  -- member_profiles tables. Field-level structure mirrors spec S7 exactly:
  -- personal, church, education, professional, choir_history, musical.
  submitted_data jsonb not null default '{}'::jsonb,
  previous_data jsonb,                      -- for information_update: prior values, for audit diff display

  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'incomplete', 'pending_review', 'under_verification',
    'pending_approval', 'approved', 'rejected', 'cancelled',
    'probation', 'probation_completed', 'probation_failed', 'converted_to_member'
  )),
  completion_percentage int not null default 0 check (completion_percentage between 0 and 100),
  missing_fields text[] not null default '{}',

  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  decision_reason text,                     -- human-authored; AI may format into a letter but never invents this (spec S43)
  decision_letter_document_id uuid,          -- FK added once documents exists (0015)

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_applications_status on public.applications (status);
create index idx_applications_existing_member on public.applications (existing_member_id);
create trigger trg_applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

comment on table public.applications is
  'New-member applications AND existing-member information-update requests (spec S8: update workflow must be separate/simplified from new-member flow, distinguished here by application_type). Never deleted, even after conversion to a member (spec S71.3).';

alter table public.members
  add constraint fk_members_application foreign key (application_id) references public.applications (id);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  document_type text not null,   -- passport_photo | national_id | application_letter | church_referral_letter | academic_certificate | professional_certificate | other
  file_path text not null,       -- Supabase Storage path, private bucket, signed URL only
  original_filename text,
  uploaded_at timestamptz not null default now()
);
create index idx_application_documents_application on public.application_documents (application_id);

-- Probation (spec S10). One row per probation period; a member could in
-- rare/edge cases have more than one over their lifetime (e.g. restored after
-- probation_failed and re-admitted later), so this is 1:N, not 1:1.
create table public.probation (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  application_id uuid references public.applications (id),
  started_at date not null default current_date,
  duration_days int not null,               -- copied from system_settings default at creation time, then fixed per-record
  deadline date not null,
  assigned_department_id uuid references public.departments (id),
  assigned_family_id uuid references public.families (id),
  responsible_leader_id uuid references public.users (id),
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'extended')),
  outcome_notes text,
  decided_by uuid references public.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_probation_member on public.probation (member_id);
create index idx_probation_deadline on public.probation (deadline) where status = 'active';
create trigger trg_probation_updated_at before update on public.probation
  for each row execute function public.set_updated_at();

comment on column public.probation.duration_days is
  'Snapshotted from system_settings.probation_duration_days at creation time so later changing the org-wide default never retroactively changes an in-flight probation deadline.';

alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.probation enable row level security;

-- Applicants have no Supabase Auth session (token-based access verified by a
-- server-side API route using the service role), so there is intentionally
-- NO anon/authenticated SELECT policy here for the applicant's own record —
-- that path is served by a service-role Edge Function that checks the token
-- server-side, not by client-side RLS. Internal HR/Secretary roles read via
-- the policy below.
create policy applications_select_hr on public.applications
  for select using (public.has_permission('members.applications.read'));
create policy applications_write_hr on public.applications
  for all using (public.has_permission('members.applications.manage'));

create policy application_documents_select_hr on public.application_documents
  for select using (public.has_permission('members.applications.read'));
create policy application_documents_write_hr on public.application_documents
  for all using (public.has_permission('members.applications.manage'));

create policy probation_select_scoped on public.probation
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('members.applications.read')
    or responsible_leader_id = auth.uid()
  );
create policy probation_write_hr on public.probation
  for all using (public.has_permission('members.applications.manage'));
