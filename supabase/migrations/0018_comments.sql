-- ============================================================================
-- 0007_comments.sql
-- Generic, polymorphic comment thread used by every module that needs
-- threaded discussion (discipline cases, invitations, agenda items, expense
-- requests, gate passes, ...) instead of a bespoke comments table per module
-- (ARCHITECTURE S6.2). Row-level security is necessarily owner-type-aware:
-- a comment on a disciplinary_case is exactly as confidential as the case
-- itself; a comment on an invitation is as open as the invitation.
-- ============================================================================

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in (
    'disciplinary_case', 'invitation', 'agenda', 'expense_request',
    'gate_pass', 'application', 'procurement_request'
  )),
  owner_id uuid not null,
  author_id uuid not null references public.users (id),
  body text not null,
  is_internal boolean not null default true, -- internal-only vs visible to the external submitter/requester where applicable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_comments_owner on public.comments (owner_type, owner_id);
create trigger trg_comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

alter table public.comments enable row level security;

-- A comment inherits the read/write authorization of whatever it is attached
-- to. Confidential owner types (disciplinary_case) require the Discipline
-- permission regardless of any other role the commenter/reader holds.
create policy comments_select_scoped on public.comments
  for select using (
    case owner_type
      when 'disciplinary_case' then public.has_permission('discipline.cases.read')
      when 'expense_request' then
        public.has_permission('finance.expenses.manage')
        or owner_id in (select id from public.expense_requests where requested_by = auth.uid())
      when 'application' then public.has_permission('members.applications.read')
      when 'gate_pass' then public.has_permission('inventory.gate_passes.read')
      when 'invitation' then public.has_permission('events.invitations.read') or auth.uid() is not null
      when 'agenda' then auth.uid() is not null
      when 'procurement_request' then public.has_permission('finance.procurement.manage')
      else false
    end
  );
create policy comments_insert_scoped on public.comments
  for insert with check (
    author_id = auth.uid()
    and case owner_type
      when 'disciplinary_case' then public.has_permission('discipline.cases.manage')
      when 'expense_request' then
        public.has_permission('finance.expenses.manage')
        or owner_id in (select id from public.expense_requests where requested_by = auth.uid())
      when 'application' then public.has_permission('members.applications.manage')
      when 'gate_pass' then public.has_permission('inventory.gate_passes.manage')
      when 'invitation' then public.has_permission('events.invitations.manage') or auth.uid() is not null
      when 'agenda' then auth.uid() is not null
      when 'procurement_request' then public.has_permission('finance.procurement.manage')
      else false
    end
  );
create policy comments_update_own on public.comments
  for update using (author_id = auth.uid());
