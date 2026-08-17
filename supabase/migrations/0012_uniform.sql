-- ============================================================================
-- 0012_uniform.sql
-- Uniform Management (spec S34): Uniform -> Invitation/Event -> Member ->
-- Assignment -> Return, with full history retained.
-- ============================================================================

create table public.uniforms (
  id uuid primary key default gen_random_uuid(),
  uniform_type text not null,       -- lookup_values('uniform_category'): choir robe, t-shirt, scarf, ...
  size text,
  quantity_total int not null default 0,
  quantity_available int not null default 0,
  condition text not null default 'good' check (condition in ('new', 'good', 'fair', 'poor', 'retired')),
  storage_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_uniforms_updated_at before update on public.uniforms
  for each row execute function public.set_updated_at();

create table public.uniform_assignments (
  id uuid primary key default gen_random_uuid(),
  uniform_id uuid not null references public.uniforms (id),
  member_id uuid not null references public.members (id),
  event_id uuid references public.events (id),   -- null for a standing/permanent issue
  quantity int not null default 1,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.users (id),
  returned_at timestamptz,
  return_condition text check (return_condition in ('good', 'damaged', 'lost', null)),
  status text not null default 'assigned' check (status in ('assigned', 'returned', 'damaged', 'lost')),
  created_at timestamptz not null default now()
);
create index idx_uniform_assignments_member on public.uniform_assignments (member_id);
create index idx_uniform_assignments_uniform on public.uniform_assignments (uniform_id);
create index idx_uniform_assignments_event on public.uniform_assignments (event_id);

alter table public.uniforms enable row level security;
alter table public.uniform_assignments enable row level security;

create policy uniforms_select_internal on public.uniforms
  for select using (auth.uid() is not null);
create policy uniforms_write_scoped on public.uniforms
  for all using (public.has_permission('uniform.inventory.manage'));

create policy uniform_assignments_select_scoped on public.uniform_assignments
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.has_permission('uniform.inventory.manage')
    or member_id in (
      select id from public.members
      where primary_department_id in (select public.current_user_department_ids())
    )
  );
create policy uniform_assignments_write_scoped on public.uniform_assignments
  for all using (public.has_permission('uniform.inventory.manage'));
