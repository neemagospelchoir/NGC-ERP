-- ============================================================================
-- 0002_rbac.sql
-- Users (profile mirror of auth.users), roles, permissions, role_permissions,
-- user_roles. Foundation for every RLS policy in later migrations.
-- ============================================================================

-- Public profile row mirroring auth.users, one-to-one. We never store
-- credentials here; Supabase Auth owns those. This table exists so the rest
-- of the schema (and RLS policies) can foreign-key to a `public` table.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext unique,
  phone text unique,
  display_name text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

comment on table public.users is 'Application-level profile mirror of auth.users. Never store passwords/secrets here.';

-- Static + admin-extendable role catalog.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- e.g. 'super_admin', 'chairman', 'department_leader'
  name text not null,
  description text,
  is_system_role boolean not null default false, -- system roles cannot be deleted, only permission-edited
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_roles_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

-- Granular permission catalog: module + action, e.g. 'finance.expenses.approve'.
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- 'module.resource.action'
  module text not null,
  resource text not null,
  action text not null,                 -- create | read | update | delete | approve | export | ...
  description text,
  created_at timestamptz not null default now()
);
create index idx_permissions_module on public.permissions (module);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- A user may hold multiple roles simultaneously, optionally scoped to a
-- department/family (e.g. "Department Leader of Alto Department" is one row:
-- role_id = department_leader, scope_type = 'department', scope_id = <dept>).
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  scope_type text check (scope_type in ('department', 'family', null)),
  scope_id uuid,
  granted_by uuid references public.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role_id, scope_type, scope_id)
);
create index idx_user_roles_user on public.user_roles (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Helper functions used throughout every later RLS policy.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_id() returns uuid
  language sql stable
  as $$ select auth.uid() $$;

create or replace function public.has_role(p_role_code text) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code = p_role_code
        and ur.revoked_at is null
    )
  $$;

create or replace function public.has_permission(p_permission_code text) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and ur.revoked_at is null
        and p.code = p_permission_code
    )
  $$;

comment on function public.has_permission(text) is
  'Single choke point for permission checks. RLS policies and the application-layer authorize() function both resolve through this, so editing Administration > Roles takes effect everywhere immediately (PRD S6, ARCHITECTURE S5.3).';

-- Department IDs the current user leads (scope_type = 'department' grants).
create or replace function public.current_user_department_ids() returns setof uuid
  language sql stable
  security definer
  set search_path = public
  as $$
    select scope_id from public.user_roles
    where user_id = auth.uid() and scope_type = 'department' and revoked_at is null
  $$;

create or replace function public.current_user_family_ids() returns setof uuid
  language sql stable
  security definer
  set search_path = public
  as $$
    select scope_id from public.user_roles
    where user_id = auth.uid() and scope_type = 'family' and revoked_at is null
  $$;

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Every authenticated user can read their own profile and roles; only
-- Super Admin / users with the relevant permission manage the RBAC tables
-- themselves. Broader per-table policies are finalized in
-- 0019_rls_policies.sql once all tables exist; these narrow "bootstrap"
-- policies just ensure RBAC tables are never left wide open in the interim.
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.has_permission('admin.users.read'));
create policy users_update_admin on public.users
  for update using (public.has_permission('admin.users.update'));

create policy roles_read_authenticated on public.roles
  for select using (auth.uid() is not null);
create policy roles_write_admin on public.roles
  for all using (public.has_permission('admin.roles.manage'));

create policy permissions_read_authenticated on public.permissions
  for select using (auth.uid() is not null);
create policy permissions_write_admin on public.permissions
  for all using (public.has_permission('admin.roles.manage'));

create policy role_permissions_read_authenticated on public.role_permissions
  for select using (auth.uid() is not null);
create policy role_permissions_write_admin on public.role_permissions
  for all using (public.has_permission('admin.roles.manage'));

create policy user_roles_select_self_or_admin on public.user_roles
  for select using (user_id = auth.uid() or public.has_permission('admin.users.read'));
create policy user_roles_write_admin on public.user_roles
  for all using (public.has_permission('admin.users.manage'));
