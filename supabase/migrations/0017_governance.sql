-- ============================================================================
-- 0017_governance.sql
-- Agenda & Voting (spec S45) and Constitution/Guidelines are served through
-- the generic documents module (category = 'Constitution'/'Policy',
-- versioned via document_versions) rather than a separate table, since
-- versioning + read/write access control is exactly what 0015 already
-- provides — see DATABASE.md for this consolidation decision.
-- ============================================================================

create table public.agendas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  voting_method text not null default 'yes_no_abstain' check (voting_method in ('yes_no_abstain', 'yes_no')),
  eligible_voter_scope text not null default 'all_members' check (eligible_voter_scope in (
    'all_members', 'department', 'family', 'leadership', 'specific_users'
  )),
  eligible_department_id uuid references public.departments (id),
  eligible_family_id uuid references public.families (id),
  eligible_user_ids uuid[] not null default '{}',
  is_anonymous boolean not null default false,
  voting_deadline timestamptz not null,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'cancelled')),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_agendas_status on public.agendas (status, voting_deadline);
create trigger trg_agendas_updated_at before update on public.agendas
  for each row execute function public.set_updated_at();

-- Vote integrity: one vote per eligible member per agenda, enforced by a
-- unique constraint on (agenda_id, voter_id) regardless of anonymity mode.
-- For is_anonymous agendas, the API/service layer is expected to strip
-- voter_id from any response projection shown to non-Super-Admin viewers —
-- the column still exists (server-side only) so integrity can be enforced
-- and audited without ever rendering a voter->vote mapping in the UI
-- (PRD S14.9: "anonymous" preserves both privacy and vote integrity).
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agendas (id) on delete cascade,
  voter_id uuid not null references public.users (id),
  choice text not null check (choice in ('yes', 'no', 'abstain')),
  cast_at timestamptz not null default now(),
  unique (agenda_id, voter_id)
);
create index idx_votes_agenda on public.votes (agenda_id);

create view public.agenda_results as
select
  agenda_id,
  count(*) filter (where choice = 'yes') as yes_count,
  count(*) filter (where choice = 'no') as no_count,
  count(*) filter (where choice = 'abstain') as abstain_count,
  count(*) as total_votes
from public.votes
group by agenda_id;

comment on view public.agenda_results is
  'Aggregate-only view. Never join votes.voter_id into any view/query exposed to a non-Super-Admin role for an is_anonymous agenda (enforced at the service/API layer per PRD S14.9).';

alter table public.agendas enable row level security;
alter table public.votes enable row level security;

create policy agendas_select_authenticated on public.agendas
  for select using (auth.uid() is not null);
create policy agendas_write_management on public.agendas
  for all using (public.has_permission('management.agenda.manage'));

-- A user may only ever see their OWN vote row directly (never another
-- member's), which is what keeps anonymous voting meaningful even though
-- voter_id is stored for integrity purposes.
create policy votes_select_own_or_admin on public.votes
  for select using (voter_id = auth.uid() or public.has_permission('management.agenda.manage'));
create policy votes_insert_self on public.votes
  for insert with check (voter_id = auth.uid());
