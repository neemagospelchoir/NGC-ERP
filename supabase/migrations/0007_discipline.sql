-- ============================================================================
-- 0007_discipline.sql
-- Confidential Discipline module (spec S33). Strict RLS: only the Discipline
-- role (and, if organizational policy explicitly allows, the member the case
-- concerns) may read; no other role — including Finance and even most HR
-- views — sees this by default (spec S53).
-- ============================================================================

create table public.disciplinary_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,      -- server-generated, e.g. DISC-2026-0001
  member_id uuid not null references public.members (id),
  category text not null,                -- admin-editable via lookup_values('discipline_category')
  incident_date date not null,
  description text not null,
  evidence_document_ids uuid[] not null default '{}', -- FKs into documents(id), validated at application layer
  officer_id uuid not null references public.users (id),
  status text not null default 'open' check (status in ('open', 'under_investigation', 'action_decided', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_disciplinary_cases_member on public.disciplinary_cases (member_id);
create index idx_disciplinary_cases_status on public.disciplinary_cases (status);
create trigger trg_disciplinary_cases_updated_at before update on public.disciplinary_cases
  for each row execute function public.set_updated_at();

create table public.disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.disciplinary_cases (id) on delete cascade,
  action_type text not null check (action_type in ('warning', 'suspension', 'probation_extension', 'dismissal', 'other')),
  decided_by uuid not null references public.users (id),
  decided_at timestamptz not null default now(),
  -- Suspension is modeled as an action subtype (start/end date columns) per
  -- ARCHITECTURE S6.2, rather than a fully separate suspensions table,
  -- since it always originates from a disciplinary (or inactivity-driven)
  -- decision and shares the same audit/approval scaffolding.
  suspension_start_date date,
  suspension_end_date date,
  resolution text,
  restored_by uuid references public.users (id),
  restored_at timestamptz,
  restoration_reason text,
  created_at timestamptz not null default now(),
  check (
    action_type <> 'suspension'
    or (suspension_start_date is not null)
  )
);
create index idx_disciplinary_actions_case on public.disciplinary_actions (case_id);
create index idx_disciplinary_actions_active_suspension
  on public.disciplinary_actions (case_id)
  where action_type = 'suspension' and restored_at is null;

comment on table public.disciplinary_actions is
  'A restored suspension (restored_at set) never deletes the row — historical discipline data must never be destroyed (spec S71.3). Restoration itself requires restored_by + restoration_reason (spec S28).';

alter table public.disciplinary_cases enable row level security;
alter table public.disciplinary_actions enable row level security;

create policy disciplinary_cases_select_discipline_only on public.disciplinary_cases
  for select using (public.has_permission('discipline.cases.read'));
create policy disciplinary_cases_write_discipline_only on public.disciplinary_cases
  for all using (public.has_permission('discipline.cases.manage'));

create policy disciplinary_actions_select_discipline_only on public.disciplinary_actions
  for select using (public.has_permission('discipline.cases.read'));
create policy disciplinary_actions_write_discipline_only on public.disciplinary_actions
  for all using (public.has_permission('discipline.cases.manage'));

comment on policy disciplinary_cases_select_discipline_only on public.disciplinary_cases is
  'Deliberately does NOT include "member_id in (select id from members where user_id = auth.uid())" — spec S33 says a member must NOT see confidential internal disciplinary detail unless organizational policy explicitly allows it. If NGC decides members should see their own resolved cases, add that policy explicitly and audit the decision; do not default to open.';
