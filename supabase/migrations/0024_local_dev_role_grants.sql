-- ============================================================================
-- 0024_local_dev_role_grants.sql
-- Local-dev-only fidelity fix, found while adversarially testing 0023's new
-- trigger against this environment's plain PostgreSQL instance.
--
-- In a real Supabase project, the platform itself creates the `anon` and
-- `authenticated` roles AND grants them broad table-level privileges
-- (SELECT/INSERT/UPDATE/DELETE) across the public schema — Supabase's
-- security model relies on RLS as the actual gate, not table-level GRANTs
-- (this is exactly what 0022's comment already notes about `anon`/
-- `authenticated` getting table privileges "directly", not just via the
-- PUBLIC pseudo-role). Our local-dev `auth` schema shim (0001) reproduces
-- `auth.uid()`, but nothing previously reproduced those base role grants —
-- so a plain `authenticated`-role session run locally hit "permission
-- denied for table members" before RLS was ever evaluated, which is a
-- false negative: it does not reproduce how the real platform behaves, and
-- would have made every RLS policy in this schema untestable locally
-- (not just the new one in 0023).
--
-- Guarded identically to 0001's own shim: only runs when `auth.uid()` does
-- not already exist as a real function, i.e. never on an actual Supabase
-- project (which provisions all of this itself before any migration runs).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid' and p.prosrc like '%app.current_user_id%'
  ) then
    -- Not the local-dev shim (a real Supabase project's auth.uid() already
    -- existed before this migration ran) — nothing to do.
    return;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
  grant execute on all functions in schema public to anon, authenticated;

  -- Mirrors Supabase's own behavior of extending the same grants to tables
  -- created by LATER migrations automatically, so a future phase's new
  -- table is testable under `authenticated`/`anon` the moment it's created,
  -- without needing its own copy of this grant.
  alter default privileges in schema public
    grant select, insert, update, delete on tables to anon, authenticated;
  alter default privileges in schema public
    grant execute on functions to anon, authenticated;
end
$$;

-- Re-apply 0022's revoke on the internal ID-sequence counter table, since
-- the blanket grant above would otherwise re-open exactly the direct-table
-- access 0022 closed (migrations run in order, but this table-level grant
-- vs. revoke ordering only matters for a from-scratch apply where 0024 runs
-- after 0022 — re-stating it here keeps this migration correct on its own
-- merits, not dependent on running after 0022 revoking it first).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public._id_sequences from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public._id_sequences from authenticated';
  end if;
end
$$;
