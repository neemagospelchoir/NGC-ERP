-- ============================================================================
-- 0009_technical.sql
-- Technical Rider & Playlist (spec S23-S24). The rider links directly to
-- Inventory via technical_rider_items referencing asset_categories once
-- inventory exists (0010); rider line items are recorded here now with the
-- category FK added in 0010 to keep dependency order clean, matching the
-- pattern already used for cross-migration FKs elsewhere in this schema.
-- ============================================================================

create table public.technical_riders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  pa_requirements text,
  lighting_requirements text,
  led_display_requirements text,
  camera_requirements text,
  recording_requirements text,
  power_requirements text,
  stage_requirements text,
  monitoring_requirements text,
  crew_notes text,
  setup_time timestamptz,
  soundcheck_time timestamptz,
  technical_notes text,
  prepared_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_technical_riders_updated_at before update on public.technical_riders
  for each row execute function public.set_updated_at();

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  title text not null default 'Event Playlist',
  shared_with_roles text[] not null default '{}',   -- role codes this playlist is shared with, beyond Technical
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_playlists_updated_at before update on public.playlists
  for each row execute function public.set_updated_at();

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  sequence_number int not null,
  song_title text not null,
  musical_key text,
  duration_seconds int,
  lead_vocal_member_id uuid references public.members (id),
  backing_vocal_member_ids uuid[] not null default '{}',
  instrument text,
  technical_notes text,
  created_at timestamptz not null default now(),
  unique (playlist_id, sequence_number)
);
create index idx_playlist_items_playlist on public.playlist_items (playlist_id);

alter table public.technical_riders enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;

create policy technical_riders_select_internal on public.technical_riders
  for select using (auth.uid() is not null);
create policy technical_riders_write_technical on public.technical_riders
  for all using (public.has_permission('technical.riders.manage'));

create policy playlists_select_scoped on public.playlists
  for select using (
    auth.uid() is not null
    and (public.has_permission('technical.playlists.manage')
         or event_id in (select event_id from public.event_participants where member_id in (
              select id from public.members where user_id = auth.uid()
            )))
  );
create policy playlists_write_technical on public.playlists
  for all using (public.has_permission('technical.playlists.manage'));

create policy playlist_items_select_scoped on public.playlist_items
  for select using (
    playlist_id in (select id from public.playlists) -- inherits playlists SELECT policy via RLS on the join
  );
create policy playlist_items_write_technical on public.playlist_items
  for all using (public.has_permission('technical.playlists.manage'));
