-- ============================================================================
-- 0016_communications.sql
-- Notification engine (spec S36, S58), Announcements (spec S37), Media
-- module (spec S20, S35 incl. "Worship in Spirit" as event_category).
-- ============================================================================

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,   -- rehearsal_reminder, event_reminder, contribution_reminder, attendance_warning, birthday, announcement, emergency, ...
  name text not null,
  channel_subject text,        -- for email
  body_template text not null, -- supports {{placeholders}}
  default_channels text[] not null default '{in_app}', -- in_app, push, email, sms, whatsapp
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_notification_templates_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users (id),
  template_id uuid references public.notification_templates (id),
  channel text not null check (channel in ('in_app', 'push', 'email', 'sms', 'whatsapp')),
  subject text,
  body text not null,
  triggering_event text,        -- e.g. 'leave.approved', 'invitation.approved'
  triggering_record_type text,
  triggering_record_id uuid,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'read')),
  sent_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index idx_notifications_recipient on public.notifications (recipient_user_id, status);
create index idx_notifications_status_queue on public.notifications (status) where status = 'queued';

alter table public.notification_templates enable row level security;
alter table public.notifications enable row level security;

create policy notification_templates_read_authenticated on public.notification_templates
  for select using (auth.uid() is not null);
create policy notification_templates_write_admin on public.notification_templates
  for all using (public.has_permission('communications.templates.manage'));

create policy notifications_select_own on public.notifications
  for select using (recipient_user_id = auth.uid() or public.has_permission('communications.notifications.read_all'));
create policy notifications_update_own_read on public.notifications
  for update using (recipient_user_id = auth.uid());
create policy notifications_insert_service on public.notifications
  for insert with check (public.has_permission('communications.notifications.send'));

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text,
  attachment_document_id uuid references public.documents (id),
  target_audience text not null default 'all' check (target_audience in (
    'all', 'department', 'family', 'event_participants', 'leadership', 'specific_users'
  )),
  target_department_id uuid references public.departments (id),
  target_family_id uuid references public.families (id),
  target_event_id uuid references public.events (id),
  target_user_ids uuid[] not null default '{}',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  publish_at timestamptz not null default now(),
  expiry_at timestamptz,
  author_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_announcements_publish on public.announcements (publish_at, expiry_at);
create trigger trg_announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

create policy announcements_select_published on public.announcements
  for select using (
    auth.uid() is not null
    and publish_at <= now()
    and (expiry_at is null or expiry_at > now())
  );
create policy announcements_write_scoped on public.announcements
  for all using (public.has_permission('communications.announcements.manage'));

create table public.media_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id),
  link_type text not null check (link_type in (
    'youtube', 'facebook', 'instagram', 'tiktok', 'google_drive', 'livestream', 'press_release', 'other'
  )),
  url text not null,
  title text,
  shared_with_roles text[] not null default '{}',
  shared_with_department_ids uuid[] not null default '{}',
  shared_with_member_ids uuid[] not null default '{}',
  is_published boolean not null default false,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_media_links_event on public.media_links (event_id);
create trigger trg_media_links_updated_at before update on public.media_links
  for each row execute function public.set_updated_at();

alter table public.media_links enable row level security;

create policy media_links_select_scoped on public.media_links
  for select using (
    is_published
    or public.has_permission('media.links.manage')
  );
create policy media_links_write_media on public.media_links
  for all using (public.has_permission('media.links.manage'));
