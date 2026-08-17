-- ============================================================================
-- 0004_members.sql
-- The single member identity table (PRD S8 / ARCHITECTURE S6.2: "members is
-- the single identity table referenced by every other domain"), its 1:1
-- profile extension, and department/family assignment history.
-- ============================================================================

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_number text not null unique,     -- formatted via next_formatted_id(), e.g. NGC-2026-0001, never reused
  user_id uuid unique references public.users (id), -- null until/unless the member has portal/mobile login
  application_id uuid,                    -- FK added in 0005 once applications exists; nullable, one-directional

  first_name text not null,
  middle_name text,
  last_name text not null,
  preferred_name text,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  date_of_birth date,
  photo_url text,
  nationality text,
  national_id_number text,

  email citext,
  phone text,
  whatsapp_number text,
  physical_address text,
  region text,
  district text,
  emergency_contact_name text,
  emergency_contact_phone text,

  primary_department_id uuid references public.departments (id),
  family_id uuid references public.families (id),

  membership_status text not null default 'probation'
    check (membership_status in ('probation', 'active', 'suspended', 'potentially_inactive', 'inactive', 'exited')),
  joined_at date,
  exited_at date,
  exit_reason text,

  qr_token uuid not null default gen_random_uuid() unique, -- opaque QR reference, resolved server-side (spec S59)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_members_status on public.members (membership_status);
create index idx_members_department on public.members (primary_department_id);
create index idx_members_family on public.members (family_id);
create index idx_members_name_trgm on public.members using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create trigger trg_members_updated_at before update on public.members
  for each row execute function public.set_updated_at();

comment on table public.members is
  'Single source-of-truth identity for every choir member. No other module may create a parallel person record (PRD S8) — all other domain tables reference members(id).';
comment on column public.members.member_number is
  'Generated via next_formatted_id(''member_number'', <format from system_settings>). Permanent, never reused, even if the member is later archived/exited.';

-- Secondary/current department assignment (a member''s primary department is
-- on members.primary_department_id; this table additionally tracks secondary
-- departments where permitted, and doubles as the full historical log of
-- every assignment change, per spec S12 "assignment changes must be recorded").
create table public.member_departments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  department_id uuid not null references public.departments (id),
  assignment_type text not null default 'secondary' check (assignment_type in ('primary', 'secondary')),
  is_current boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  changed_by uuid references public.users (id),
  notes text
);
create index idx_member_departments_member on public.member_departments (member_id);
create index idx_member_departments_current on public.member_departments (department_id) where is_current;

create table public.member_families (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id),
  is_current boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  changed_by uuid references public.users (id),
  notes text
);
create index idx_member_families_member on public.member_families (member_id);

-- 1:1 extension holding the richer onboarding-derived profile data (church,
-- education, professional, choir history, musical information) so the
-- members table itself stays lean and query-friendly for the common case.
create table public.member_profiles (
  member_id uuid primary key references public.members (id) on delete cascade,

  current_church text,
  church_location text,
  pastor_name text,
  church_membership_info text,
  referral_info text,

  education jsonb not null default '[]'::jsonb,      -- [{qualification, institution, year, document_id}]
  profession text,
  employer text,
  professional_qualifications jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',

  previously_choir_member boolean not null default false,
  previous_choir_name text,
  previous_choir_duration text,
  previous_choir_responsibilities text,
  previous_choir_leave_reason text,
  musical_experience text,

  vocal_category text,          -- e.g. Soprano/Alto/Tenor/Bass, admin-editable via lookup_values('vocal_category')
  instrument text,
  musical_skills text[] not null default '{}',
  music_training text,
  previous_performance_experience text,

  notes text,
  updated_at timestamptz not null default now()
);
create trigger trg_member_profiles_updated_at before update on public.member_profiles
  for each row execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.member_departments enable row level security;
alter table public.member_families enable row level security;
alter table public.member_profiles enable row level security;

-- Bootstrap policies (finalized/tightened in 0020_rls_policies.sql once
-- discipline/finance tables exist and cross-module confidentiality can be
-- fully expressed). A member can always read (and lightly update) their own
-- record; HR and Super Admin manage all; department leaders read their own
-- department's members.
create policy members_select_scoped on public.members
  for select using (
    user_id = auth.uid()
    or public.has_permission('members.profiles.read_all')
    or primary_department_id in (select public.current_user_department_ids())
    or family_id in (select public.current_user_family_ids())
  );
create policy members_update_self_limited on public.members
  for update using (user_id = auth.uid() or public.has_permission('members.profiles.manage'));
create policy members_write_hr on public.members
  for insert with check (public.has_permission('members.profiles.manage'));
create policy members_delete_admin on public.members
  for delete using (public.has_permission('members.profiles.manage'));

create policy member_departments_select_scoped on public.member_departments
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('members.profiles.read_all')
    or department_id in (select public.current_user_department_ids())
  );
create policy member_departments_write_hr on public.member_departments
  for all using (public.has_permission('members.profiles.manage'));

create policy member_families_select_scoped on public.member_families
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('members.profiles.read_all')
    or family_id in (select public.current_user_family_ids())
  );
create policy member_families_write_hr on public.member_families
  for all using (public.has_permission('members.profiles.manage'));

create policy member_profiles_select_scoped on public.member_profiles
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('members.profiles.read_all')
    or member_id in (
      select id from public.members
      where primary_department_id in (select public.current_user_department_ids())
    )
  );
create policy member_profiles_write_hr on public.member_profiles
  for all using (public.has_permission('members.profiles.manage'));
