-- ============================================================================
-- 0003_lookup_and_org_structure.sql
-- Generic, admin-editable lookup values (spec S60 "do not hardcode
-- institutional rules") + Departments and Families (spec S12).
-- ============================================================================

-- Generic configurable category/status registry used by modules whose
-- category or status list the spec explicitly calls "configurable" and which
-- do not otherwise get a dedicated table (asset_categories, vendor_categories
-- and document_categories DO get dedicated tables later because the spec
-- names them as first-class entities; this table covers the smaller,
-- lighter-weight lists: attendance status, expense category, uniform
-- category/type, contribution category, notification channel toggles, etc.)
create table public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  category text not null,        -- e.g. 'attendance_status', 'expense_category', 'uniform_category'
  code text not null,            -- stable machine code, e.g. 'present', 'excused'
  label text not null,           -- human label shown in UI
  sort_order int not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, -- e.g. {"counts_as_present": true} for attendance status
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, code)
);
create index idx_lookup_values_category on public.lookup_values (category) where is_active;
create trigger trg_lookup_values_updated_at before update on public.lookup_values
  for each row execute function public.set_updated_at();

comment on table public.lookup_values is
  'Admin-editable category/status registries (spec S60). Never hardcode these lists in application code — always read from here.';

-- Departments -----------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  leader_user_id uuid references public.users (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

-- Families ----------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  leader_user_id uuid references public.users (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_families_updated_at before update on public.families
  for each row execute function public.set_updated_at();

alter table public.lookup_values enable row level security;
alter table public.departments enable row level security;
alter table public.families enable row level security;

create policy lookup_values_read_authenticated on public.lookup_values
  for select using (auth.uid() is not null);
create policy lookup_values_write_admin on public.lookup_values
  for all using (public.has_permission('admin.settings.manage'));

create policy departments_read_authenticated on public.departments
  for select using (auth.uid() is not null);
create policy departments_write_admin on public.departments
  for all using (public.has_permission('admin.departments.manage'));

create policy families_read_authenticated on public.families
  for select using (auth.uid() is not null);
create policy families_write_admin on public.families
  for all using (public.has_permission('admin.families.manage'));
