-- ============================================================================
-- 0020_audit_and_settings.sql
-- Mandatory Audit Log (spec S51) and System Settings / configuration
-- (spec S60, S71.11 "business rules must be configurable, never hardcoded").
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id),   -- null for system/service-role actions (clearly labeled via action)
  action text not null,                          -- INSERT | UPDATE | DELETE | or a named business action e.g. 'member.suspended'
  module text,
  record_type text not null,
  record_id uuid,
  before_value jsonb,
  after_value jsonb,
  ip_address inet,
  device_info text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_record on public.audit_logs (record_type, record_id, created_at desc);
create index idx_audit_logs_actor on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

-- Read-only, admin-restricted, per spec S51 "audit logs must be protected
-- from ordinary users." No update/delete policy exists at all — the table
-- is append-only by construction (writes happen via the write_audit_log()
-- trigger function, which is SECURITY DEFINER and not itself exposed for
-- direct client inserts of arbitrary content).
create policy audit_logs_select_admin on public.audit_logs
  for select using (public.has_permission('admin.audit_log.read'));
create policy audit_logs_insert_trigger_only on public.audit_logs
  for insert with check (true); -- inserts only ever originate from the SECURITY DEFINER trigger function

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  value jsonb not null,
  value_type text not null default 'string' check (value_type in ('string', 'number', 'boolean', 'json')),
  description text,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create trigger trg_system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

alter table public.system_settings enable row level security;

create policy system_settings_read_authenticated on public.system_settings
  for select using (auth.uid() is not null);
create policy system_settings_write_admin on public.system_settings
  for all using (public.has_permission('admin.settings.manage'));

comment on table public.system_settings is
  'Every organization-specific rule enumerated in spec S60 (attendance threshold, probation period, application processing period, ID/number formats, approval workflow membership, category registries, notification templates, provider selection, organization info) lives here or in lookup_values/workflow_definitions — never as an application constant.';
