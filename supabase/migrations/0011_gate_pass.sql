-- ============================================================================
-- 0011_gate_pass.sql
-- Automatic Gate Pass (spec S17), generated from an event's equipment
-- assignment, with a configurable approval chain resolved through the
-- generic workflow engine (0019) once it exists — the approval STEPS are
-- recorded there; this table holds the gate pass content and current status.
-- ============================================================================

create table public.gate_passes (
  id uuid primary key default gen_random_uuid(),
  gate_pass_number text not null unique,   -- server-generated
  event_id uuid not null references public.events (id),
  person_responsible_id uuid not null references public.users (id),
  department_id uuid references public.departments (id),
  expected_departure timestamptz,
  expected_return timestamptz,
  status text not null default 'pending_approval' check (status in (
    'pending_approval', 'approved', 'rejected', 'checked_out', 'in_transit',
    'returned', 'partially_returned', 'damaged', 'lost'
  )),
  qr_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_gate_passes_event on public.gate_passes (event_id);
create index idx_gate_passes_status on public.gate_passes (status);
create trigger trg_gate_passes_updated_at before update on public.gate_passes
  for each row execute function public.set_updated_at();

create table public.gate_pass_items (
  id uuid primary key default gen_random_uuid(),
  gate_pass_id uuid not null references public.gate_passes (id) on delete cascade,
  asset_id uuid not null references public.assets (id),
  quantity int not null default 1,
  checked_out_at timestamptz,
  returned_at timestamptz,
  return_condition text check (return_condition in ('good', 'damaged', 'lost', null)),
  created_at timestamptz not null default now()
);
create index idx_gate_pass_items_gate_pass on public.gate_pass_items (gate_pass_id);
create index idx_gate_pass_items_asset on public.gate_pass_items (asset_id);

alter table public.gate_passes enable row level security;
alter table public.gate_pass_items enable row level security;

create policy gate_passes_select_internal on public.gate_passes
  for select using (auth.uid() is not null);
create policy gate_passes_write_scoped on public.gate_passes
  for all using (
    public.has_permission('inventory.gate_passes.manage')
    or person_responsible_id = auth.uid()
  );

create policy gate_pass_items_select_internal on public.gate_pass_items
  for select using (auth.uid() is not null);
create policy gate_pass_items_write_scoped on public.gate_pass_items
  for all using (public.has_permission('inventory.gate_passes.manage'));
