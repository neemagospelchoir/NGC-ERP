-- ============================================================================
-- 0010_inventory.sql
-- Inventory / Asset Management (spec S15) + generic, polymorphic asset
-- assignment (spec S16, S34 uniform borrows the same shape conceptually but
-- keeps its own table since uniform has its own size/condition workflow —
-- see 0012_uniform.sql).
-- ============================================================================

create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,     -- Audio Equipment, Cameras, Lighting, LED/Display, Musical Instruments, Computers, Networking, Furniture, Transportation, Production, Other
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique,      -- server-generated formatted ID
  category_id uuid not null references public.asset_categories (id),
  name text not null,
  serial_number text,
  purchase_date date,
  purchase_value numeric(14,2),
  current_value numeric(14,2),
  currency text not null default 'TZS',
  condition text not null default 'good' check (condition in ('new', 'good', 'fair', 'poor', 'damaged', 'disposed')),
  location text,
  custodian_user_id uuid references public.users (id),
  owning_department_id uuid references public.departments (id),
  availability_status text not null default 'available'
    check (availability_status in ('available', 'assigned', 'under_maintenance', 'missing', 'disposed')),
  photo_urls text[] not null default '{}',
  qr_token uuid not null default gen_random_uuid() unique,
  disposed_at timestamptz,
  disposal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assets_category on public.assets (category_id);
create index idx_assets_availability on public.assets (availability_status);
create trigger trg_assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

comment on table public.assets is
  'Disposal never deletes the row (condition/availability_status = disposed instead), preserving assignment/return/damage history permanently (spec S15, S71.3).';

-- Generic assignment record: an asset can be assigned to a member, a
-- department, or an event (spec S16''s equipment-to-event example; general
-- inventory can also be assigned to a member or department) — one table
-- with a polymorphic target instead of three near-identical ones
-- (ARCHITECTURE S6.2).
create table public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id),
  target_type text not null check (target_type in ('member', 'department', 'event')),
  target_id uuid not null,
  quantity int not null default 1,
  assigned_by uuid references public.users (id),
  assigned_at timestamptz not null default now(),
  expected_return_at timestamptz,
  returned_at timestamptz,
  return_condition text check (return_condition in ('good', 'damaged', 'lost', null)),
  damage_report text,
  status text not null default 'assigned'
    check (status in ('assigned', 'returned', 'partially_returned', 'damaged', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_asset_assignments_asset on public.asset_assignments (asset_id);
create index idx_asset_assignments_target on public.asset_assignments (target_type, target_id);
create index idx_asset_assignments_active on public.asset_assignments (asset_id) where returned_at is null;
create trigger trg_asset_assignments_updated_at before update on public.asset_assignments
  for each row execute function public.set_updated_at();

-- Prevents double-booking the same asset to overlapping *event* assignments
-- unless explicitly authorized (spec S16): a partial unique index blocks a
-- second concurrent, unreturned assignment of the same asset to an event.
-- Application-layer availability checks additionally compare event dates for
-- non-event target types; this index is the hard database-level backstop
-- for the most common double-booking case.
create unique index uq_asset_assignments_no_concurrent_event_booking
  on public.asset_assignments (asset_id)
  where target_type = 'event' and returned_at is null and status = 'assigned';

alter table public.asset_categories enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;

create policy asset_categories_read_authenticated on public.asset_categories
  for select using (auth.uid() is not null);
create policy asset_categories_write_admin on public.asset_categories
  for all using (public.has_permission('inventory.categories.manage'));

create policy assets_select_internal on public.assets
  for select using (auth.uid() is not null);
create policy assets_write_inventory on public.assets
  for all using (public.has_permission('inventory.assets.manage'));

create policy asset_assignments_select_internal on public.asset_assignments
  for select using (auth.uid() is not null);
create policy asset_assignments_write_inventory on public.asset_assignments
  for all using (public.has_permission('inventory.assets.manage') or public.has_permission('technical.equipment.assign'));
