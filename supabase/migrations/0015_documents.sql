-- ============================================================================
-- 0015_documents.sql
-- Centralized Document Management (spec S14, S46, S56). Generic/polymorphic
-- owner_type + owner_id so member/HR/financial/event/technical/logistics/
-- legal/church/report/media/administrative documents, and the versioned
-- Constitution & Guidelines library, all share one implementation rather
-- than a bespoke table per category (deliberate consolidation vs the raw
-- spec S61 entity list — see DATABASE.md).
-- ============================================================================

create table public.document_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,   -- Member, HR, Financial, Event, Technical, Logistics, Legal, Church, Constitution, Policy, Report, Contract, Media, Administrative
  is_confidential boolean not null default false,  -- e.g. Discipline-tagged documents
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.document_categories (id),
  owner_type text check (owner_type in (
    'member', 'department', 'event', 'vendor', 'asset', 'invitation',
    'disciplinary_case', 'expense_request', 'constitution', 'organization', null
  )),
  owner_id uuid,
  title text not null,
  tags text[] not null default '{}',
  owner_user_id uuid references public.users (id),   -- the uploader/document owner for access-control purposes
  expiry_date date,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_by uuid references public.users (id),
  archived_at timestamptz,
  restore_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_documents_owner on public.documents (owner_type, owner_id);
create index idx_documents_category on public.documents (category_id);
create index idx_documents_tags on public.documents using gin (tags);
create trigger trg_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version_number int not null,
  file_path text not null,          -- Supabase Storage path, private bucket; served only via signed URL (spec S14)
  file_size_bytes bigint,
  uploaded_by uuid references public.users (id),
  uploaded_at timestamptz not null default now(),
  unique (document_id, version_number)
);
create index idx_document_versions_document on public.document_versions (document_id);

-- Now that documents exists, wire up the forward-declared FKs from earlier
-- migrations (applications, leave_requests, itineraries, expense_requests).
alter table public.applications add constraint fk_applications_decision_letter
  foreign key (decision_letter_document_id) references public.documents (id);
alter table public.leave_requests add constraint fk_leave_requests_supporting_document
  foreign key (supporting_document_id) references public.documents (id);
alter table public.itineraries add constraint fk_itineraries_document
  foreign key (generated_document_id) references public.documents (id);
alter table public.expense_requests add constraint fk_expense_requests_supporting_document
  foreign key (supporting_document_id) references public.documents (id);

alter table public.document_categories enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;

create policy document_categories_read_authenticated on public.document_categories
  for select using (auth.uid() is not null);
create policy document_categories_write_admin on public.document_categories
  for all using (public.has_permission('documents.categories.manage'));

-- Confidentiality-aware read policy: a document in a category flagged
-- is_confidential (Discipline) requires the Discipline permission
-- regardless of any other general document permission (spec S33/S53
-- enforced again here, independent of the disciplinary_cases table policy,
-- because evidence documents live in this table too).
create policy documents_select_scoped on public.documents
  for select using (
    status = 'active'
    and (
      exists (
        select 1 from public.document_categories dc
        where dc.id = documents.category_id and dc.is_confidential
      ) and public.has_permission('discipline.cases.read')
      or (
        not exists (
          select 1 from public.document_categories dc
          where dc.id = documents.category_id and dc.is_confidential
        )
        and (
          public.has_permission('documents.read_all')
          or owner_user_id = auth.uid()
          or (owner_type = 'member' and owner_id in (select id from public.members where user_id = auth.uid()))
        )
      )
    )
  );
create policy documents_write_scoped on public.documents
  for all using (
    public.has_permission('documents.manage')
    or owner_user_id = auth.uid()
  );

create policy document_versions_select_scoped on public.document_versions
  for select using (document_id in (select id from public.documents)); -- inherits documents SELECT policy
create policy document_versions_write_scoped on public.document_versions
  for all using (
    document_id in (select id from public.documents where owner_user_id = auth.uid())
    or public.has_permission('documents.manage')
  );
