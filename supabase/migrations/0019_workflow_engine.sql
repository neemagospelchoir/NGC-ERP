-- ============================================================================
-- 0019_workflow_engine.sql
-- Reusable, configurable multi-step approval workflow engine (ARCHITECTURE
-- S12) backing Invitations, Expenses, Gate Passes, Applications, and
-- Procurement, instead of one-off approval logic per module. The
-- Management Approval Center (spec S44) is a permission-scoped query over
-- workflow_instances + workflow_step_decisions, not a bespoke table.
-- ============================================================================

create table public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,     -- 'invitation' | 'expense_request' | 'gate_pass' | 'application' | 'procurement_request'
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, name)
);
create trigger trg_workflow_definitions_updated_at before update on public.workflow_definitions
  for each row execute function public.set_updated_at();

create table public.workflow_definition_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions (id) on delete cascade,
  step_order int not null,
  required_role_code text references public.roles (code),  -- e.g. 'secretary'; null if required_user_id is set instead
  required_user_id uuid references public.users (id),
  is_mandatory boolean not null default true,
  unique (workflow_definition_id, step_order)
);

create table public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions (id),
  record_type text not null,
  record_id uuid not null,
  current_step_order int not null default 1,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, record_id)
);
create index idx_workflow_instances_pending on public.workflow_instances (record_type, current_step_order) where status = 'pending';
create trigger trg_workflow_instances_updated_at before update on public.workflow_instances
  for each row execute function public.set_updated_at();

create table public.workflow_step_decisions (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.workflow_instances (id) on delete cascade,
  step_order int not null,
  approver_id uuid not null references public.users (id),
  approver_role_code text references public.roles (code),
  decision text not null check (decision in ('approve', 'reject', 'request_changes')),
  comment text,
  decided_at timestamptz not null default now(),
  ip_address inet,
  device_info text
);
create index idx_workflow_step_decisions_instance on public.workflow_step_decisions (workflow_instance_id);

comment on table public.workflow_step_decisions is
  'Every approval records approver, role, decision, comment, timestamp, and (where legally appropriate) IP/device — spec S21. This single table backs that requirement for every workflow-driven module at once.';

alter table public.workflow_definitions enable row level security;
alter table public.workflow_definition_steps enable row level security;
alter table public.workflow_instances enable row level security;
alter table public.workflow_step_decisions enable row level security;

create policy workflow_definitions_read_authenticated on public.workflow_definitions
  for select using (auth.uid() is not null);
create policy workflow_definitions_write_admin on public.workflow_definitions
  for all using (public.has_permission('admin.workflows.manage'));

create policy workflow_definition_steps_read_authenticated on public.workflow_definition_steps
  for select using (auth.uid() is not null);
create policy workflow_definition_steps_write_admin on public.workflow_definition_steps
  for all using (public.has_permission('admin.workflows.manage'));

-- Instances/decisions are visible to: the requester (via the owning
-- module's own record, checked at the service layer since record_type is
-- polymorphic and RLS cannot easily join to N different tables generically);
-- any user holding the required role for the CURRENT step (so their
-- Approval Center query works); and anyone with the cross-module
-- management.approvals.read_all permission (Super Admin, Secretary).
create policy workflow_instances_select_scoped on public.workflow_instances
  for select using (
    public.has_permission('management.approvals.read_all')
    or exists (
      select 1 from public.workflow_definition_steps s
      where s.workflow_definition_id = workflow_instances.workflow_definition_id
        and s.step_order = workflow_instances.current_step_order
        and (s.required_user_id = auth.uid() or public.has_role(coalesce(s.required_role_code, '')))
    )
  );
create policy workflow_instances_write_service on public.workflow_instances
  for all using (public.has_permission('management.approvals.manage'));

create policy workflow_step_decisions_select_scoped on public.workflow_step_decisions
  for select using (
    approver_id = auth.uid()
    or public.has_permission('management.approvals.read_all')
  );
create policy workflow_step_decisions_insert_approver on public.workflow_step_decisions
  for insert with check (approver_id = auth.uid());
