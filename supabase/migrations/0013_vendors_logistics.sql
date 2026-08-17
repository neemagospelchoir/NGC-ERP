-- ============================================================================
-- 0013_vendors_logistics.sql
-- Vendor database (spec S18, S30, shared across Logistics/Inventory/
-- Procurement) + Logistics/Trips/Itineraries (spec S18, S40).
-- ============================================================================

create table public.vendor_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,   -- Transport, Uniform Tailor, Equipment, Accommodation, Catering, Printing, Other
  created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.vendor_categories (id),
  contact_person text,
  phone text,
  email citext,
  address text,
  tax_information text,          -- access-controlled at application layer for finance-only display
  bank_payment_information text, -- access-controlled; never exposed in general vendor list views
  performance_notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'blacklisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_vendors_category on public.vendors (category_id);
create trigger trg_vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

comment on column public.vendors.bank_payment_information is
  'Column-level exposure of payment info is additionally restricted in the API/service layer view used by non-finance roles (e.g. Logistics sees vendor contact but not banking details) — RLS grants row access, the service layer projects which columns each role''s response includes.';

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  destination text,
  vehicle_requirement text,
  driver_name text,
  transport_vendor_id uuid references public.vendors (id),
  accommodation_vendor_id uuid references public.vendors (id),
  departure_at timestamptz,
  arrival_at timestamptz,
  return_departure_at timestamptz,
  return_arrival_at timestamptz,
  estimated_cost numeric(14,2),
  actual_cost numeric(14,2),
  currency text not null default 'TZS',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_trips_event on public.trips (event_id);
create trigger trg_trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  assigned_member_ids uuid[] not null default '{}',
  generated_at timestamptz not null default now(),
  generated_document_id uuid,   -- FK added once documents exists (0015); the exported PDF
  notes text
);

alter table public.vendor_categories enable row level security;
alter table public.vendors enable row level security;
alter table public.trips enable row level security;
alter table public.itineraries enable row level security;

create policy vendor_categories_read_authenticated on public.vendor_categories
  for select using (auth.uid() is not null);
create policy vendor_categories_write_admin on public.vendor_categories
  for all using (public.has_permission('logistics.vendors.manage'));

create policy vendors_select_internal on public.vendors
  for select using (auth.uid() is not null);
create policy vendors_write_scoped on public.vendors
  for all using (public.has_permission('logistics.vendors.manage') or public.has_permission('finance.vendors.manage'));

create policy trips_select_internal on public.trips
  for select using (auth.uid() is not null);
create policy trips_write_logistics on public.trips
  for all using (public.has_permission('logistics.trips.manage'));

create policy itineraries_select_internal on public.itineraries
  for select using (auth.uid() is not null);
create policy itineraries_write_logistics on public.itineraries
  for all using (public.has_permission('logistics.trips.manage'));
