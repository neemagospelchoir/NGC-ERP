-- ============================================================================
-- 0001_extensions_and_helpers.sql
-- Extensions, dev-environment shims, and generic helper functions/triggers
-- used by every later migration.
--
-- NOTE ON THE `auth` SCHEMA SHIM BELOW:
-- In a real Supabase project, the `auth` schema and `auth.uid()` / `auth.jwt()`
-- are provided natively by Supabase Auth (GoTrue) and must NOT be created by
-- application migrations. This migration creates a *local-development-only*
-- shim so the exact same RLS policies we ship to Supabase can be exercised
-- and tested against a plain, local PostgreSQL instance (as we do in this
-- repository's CI and in the sandbox that authored these migrations).
-- The shim is guarded so it never runs against a database that already has
-- a real `auth.uid()` function (i.e. an actual Supabase project).
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email/username matching
create extension if not exists pg_trgm;    -- trigram search for global search module

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    -- Local dev/test shim only. Real Supabase provides this natively.
    create schema if not exists auth;

    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email citext unique,
      phone text unique,
      encrypted_password text,
      created_at timestamptz not null default now()
    );

    create or replace function auth.uid() returns uuid
      language sql stable
      as $fn$
        select nullif(current_setting('app.current_user_id', true), '')::uuid
      $fn$;

    create or replace function auth.role() returns text
      language sql stable
      as $fn$
        select coalesce(nullif(current_setting('app.current_user_role', true), ''), 'anon')
      $fn$;
  end if;
end
$$;

-- Generic updated_at trigger, reused by every table with an updated_at column.
create or replace function public.set_updated_at() returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

-- Generic append-only audit trigger. Writes a row to audit_logs for every
-- insert/update/delete on any table it is attached to. Attached explicitly
-- per-table in 9990_audit_triggers.sql once audit_logs exists, not here.
create or replace function public.write_audit_log() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_actor uuid;
    v_record_id uuid;
  begin
    v_actor := auth.uid();

    if tg_op = 'DELETE' then
      v_record_id := old.id;
    else
      v_record_id := new.id;
    end if;

    insert into public.audit_logs (
      actor_id, action, module, record_type, record_id,
      before_value, after_value, created_at
    ) values (
      v_actor,
      tg_op,
      tg_table_schema,
      tg_table_name,
      v_record_id,
      case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end,
      now()
    );

    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end;
  $$;

-- Formatted, configurable sequential identifiers (Member ID, Application
-- Number, Invitation Number, Gate Pass ID, ...). Format templates live in
-- system_settings (see 0018_audit_settings.sql) so they are administrator
-- configurable, never hardcoded (spec S60/S71.11). This function is created
-- here and re-pointed at system_settings once that table exists via
-- CREATE OR REPLACE in 0018.
create table if not exists public._id_sequences (
  sequence_key text primary key,
  year int not null,
  last_value bigint not null default 0
);

create or replace function public.next_formatted_id(p_sequence_key text, p_format text)
returns text
language plpgsql
as $$
declare
  v_year int := extract(year from now())::int;
  v_next bigint;
  v_result text;
begin
  insert into public._id_sequences (sequence_key, year, last_value)
  values (p_sequence_key, v_year, 1)
  on conflict (sequence_key) do update
    set last_value = case
          when public._id_sequences.year = v_year
            then public._id_sequences.last_value + 1
          else 1
        end,
        year = v_year
  returning last_value into v_next;

  v_result := replace(p_format, '{year}', v_year::text);
  v_result := replace(v_result, '{sequence}', lpad(v_next::text, 4, '0'));
  return v_result;
end;
$$;

comment on function public.next_formatted_id(text, text) is
  'Generates a unique, never-reused, server-side formatted identifier (e.g. NGC-2026-0001) from an admin-configurable template. Never generate these IDs client-side.';
