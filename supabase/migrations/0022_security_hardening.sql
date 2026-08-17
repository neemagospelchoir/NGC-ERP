-- ============================================================================
-- 0022_security_hardening.sql
-- Follow-up hardening found during Phase 4 validation (spec S73 step 9-10
-- security/authorization review):
--
-- 1. next_formatted_id() must be SECURITY DEFINER, consistent with the other
--    shared utility functions (has_permission, has_role, write_audit_log),
--    so any authorized authenticated caller can generate a formatted ID
--    without needing direct table privileges on the internal
--    _id_sequences counter table. Access to that table itself stays locked
--    to the function only.
-- 2. Explicitly REVOKE public/anon table access to internal helper tables
--    that must only ever be touched through a function, never directly.
-- ============================================================================

create or replace function public.next_formatted_id(p_sequence_key text, p_format text)
returns text
language plpgsql
security definer
set search_path = public
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

revoke all on public._id_sequences from public;
-- Supabase's default project setup grants table privileges directly to the
-- `anon` and `authenticated` roles (not just the PUBLIC pseudo-role), so
-- revoking from PUBLIC alone is not sufficient there. Revoke from those
-- roles explicitly when they exist (they do not exist in the local-dev shim
-- used to author/test these migrations, hence the guard).
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
-- No GRANT to anon/authenticated is added back: the table is reachable only
-- via the SECURITY DEFINER function above, which runs with the privileges of
-- its owner (the migration-running role / Supabase schema owner) regardless
-- of who calls it.
