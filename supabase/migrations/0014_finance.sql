-- ============================================================================
-- 0014_finance.sql
-- Finance: Contributions (spec S29), Petty Cash/Expenses (spec S31),
-- Procurement (spec S32). Discipline confidentiality is NOT weakened here —
-- Finance roles get no special read access to disciplinary_cases (spec S53).
-- ============================================================================

create table public.contribution_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  target_amount numeric(14,2),
  currency text not null default 'TZS',
  deadline date,
  status text not null default 'active' check (status in ('draft', 'active', 'closed', 'cancelled')),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_contribution_campaigns_updated_at before update on public.contribution_campaigns
  for each row execute function public.set_updated_at();

create table public.contribution_records (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.contribution_campaigns (id),
  member_id uuid not null references public.members (id),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'TZS',
  contributed_at date not null default current_date,
  payment_method text,           -- lookup_values('payment_method'): cash, mobile_money, bank_transfer, ...
  reference text,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'reversed')),
  notes text,
  recorded_by uuid references public.users (id),
  created_at timestamptz not null default now()
);
create index idx_contribution_records_campaign on public.contribution_records (campaign_id);
create index idx_contribution_records_member on public.contribution_records (member_id);

create view public.contribution_campaign_summary as
select
  c.id as campaign_id,
  c.name,
  c.target_amount,
  count(distinct r.member_id) as total_contributors,
  coalesce(sum(r.amount) filter (where r.status = 'confirmed'), 0) as total_contributed,
  greatest(coalesce(c.target_amount, 0) - coalesce(sum(r.amount) filter (where r.status = 'confirmed'), 0), 0) as outstanding_amount,
  case when coalesce(c.target_amount, 0) = 0 then null
       else round(100.0 * coalesce(sum(r.amount) filter (where r.status = 'confirmed'), 0) / c.target_amount, 2)
  end as achievement_percentage
from public.contribution_campaigns c
left join public.contribution_records r on r.campaign_id = c.id
group by c.id;

create table public.expense_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  requested_by uuid not null references public.users (id),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'TZS',
  category text,                 -- lookup_values('expense_category')
  department_id uuid references public.departments (id),
  event_id uuid references public.events (id),
  supporting_document_id uuid,   -- FK added once documents exists (0015)
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid', 'closed'
  )),
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_expense_requests_status on public.expense_requests (status);
create index idx_expense_requests_requester on public.expense_requests (requested_by);
create trigger trg_expense_requests_updated_at before update on public.expense_requests
  for each row execute function public.set_updated_at();

create table public.procurement_requests (
  id uuid primary key default gen_random_uuid(),
  expense_request_id uuid not null references public.expense_requests (id),
  vendor_id uuid references public.vendors (id),
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'vendor_selected', 'purchased', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_procurement_requests_expense on public.procurement_requests (expense_request_id);
create trigger trg_procurement_requests_updated_at before update on public.procurement_requests
  for each row execute function public.set_updated_at();

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  procurement_request_id uuid not null references public.procurement_requests (id),
  vendor_id uuid not null references public.vendors (id),
  amount numeric(14,2) not null,
  currency text not null default 'TZS',
  purchased_at timestamptz,
  paid_at timestamptz,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'partially_paid')),
  -- If the purchased item is an asset, this is populated with the new/updated
  -- inventory row (spec S32 "automatically create or suggest an inventory
  -- record"); left null when the purchase is a consumable/non-asset expense.
  created_asset_id uuid references public.assets (id),
  created_at timestamptz not null default now()
);
create index idx_purchase_orders_procurement on public.purchase_orders (procurement_request_id);

alter table public.contribution_campaigns enable row level security;
alter table public.contribution_records enable row level security;
alter table public.expense_requests enable row level security;
alter table public.procurement_requests enable row level security;
alter table public.purchase_orders enable row level security;

create policy contribution_campaigns_select_internal on public.contribution_campaigns
  for select using (auth.uid() is not null);
create policy contribution_campaigns_write_finance on public.contribution_campaigns
  for all using (public.has_permission('finance.contributions.manage'));

create policy contribution_records_select_scoped on public.contribution_records
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('finance.contributions.manage')
    or public.has_permission('finance.contributions.read')
  );
create policy contribution_records_write_finance on public.contribution_records
  for all using (public.has_permission('finance.contributions.manage'));

create policy expense_requests_select_scoped on public.expense_requests
  for select using (
    requested_by = auth.uid()
    or public.has_permission('finance.expenses.manage')
    or public.has_permission('finance.expenses.approve')
  );
create policy expense_requests_insert_self on public.expense_requests
  for insert with check (requested_by = auth.uid());
create policy expense_requests_update_scoped on public.expense_requests
  for update using (
    (requested_by = auth.uid() and status = 'draft')
    or public.has_permission('finance.expenses.manage')
    or public.has_permission('finance.expenses.approve')
  );

create policy procurement_requests_select_finance on public.procurement_requests
  for select using (public.has_permission('finance.procurement.manage') or public.has_permission('finance.expenses.manage'));
create policy procurement_requests_write_finance on public.procurement_requests
  for all using (public.has_permission('finance.procurement.manage'));

create policy purchase_orders_select_finance on public.purchase_orders
  for select using (public.has_permission('finance.procurement.manage') or public.has_permission('finance.expenses.manage'));
create policy purchase_orders_write_finance on public.purchase_orders
  for all using (public.has_permission('finance.procurement.manage'));
