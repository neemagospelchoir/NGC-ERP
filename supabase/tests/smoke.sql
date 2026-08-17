-- ============================================================================
-- smoke.sql
-- Phase 14.2 (QA), extended by Phase 14.4 (QA capstone). A repeatable
-- database-integration/smoke-test suite, automating exactly the kind of ad
-- hoc `psql` scenario testing this project has done by hand, one-off, in
-- nearly every phase since Phase 4 (most recently and extensively in
-- Phase 14.1 — see that migration's own comments for the two real bugs that
-- manual process caught before ship). docs/PHASE_14_1.md §7 named "no
-- automated DB-integration test suite exists yet" as an open gap and a good
-- candidate for this sub-phase; this file is that suite.
--
-- SCOPE: this is a smoke test, not exhaustive RLS coverage of the whole
-- schema (unit tests already cover packages/services against a mock, and
-- apps/web/e2e covers the application layer against a mock GoTrue/PostgREST
-- server — see docs/AUTHENTICATION.md §4 for why neither of those exercises
-- real Postgres RLS/triggers). This suite specifically re-verifies, against
-- a REAL Postgres instance with RLS enforced, the security-critical
-- database-layer behavior that has no other automated coverage:
--
-- Scenarios A-H (Phase 14.2): the Phase 14.1 workflow-bypass guard (0036)
-- for Invitations/Expense Requests/Gate Passes (including the exact
-- "declined"/"rejected" vocabulary mismatch and "skip approval via an
-- unguarded exit" bugs that shipped only after manual/review discovery),
-- the Procurement state-machine guard, the workflow_instances insert-only
-- narrowing, playlist role-sharing (0037), event_participants read scoping
-- (0037), and the attendance recorded_by WITH CHECK (0038).
--
-- Scenarios I-M (Phase 14.4): docs/PHASE_14_2.md §7 named "exhaustive RLS
-- coverage remains manual" as a reasonable candidate for 14.4's own
-- capstone pass — these five scenarios extend coverage to real RLS gaps
-- caught and fixed by EARLIER phases' own security reviews, on their own,
-- but that (unlike 14.1's fixes) never received automated DB-layer
-- coverage: discipline member-access scoping (0026), announcements select
-- scope (0032), the send_notification RPC's audience fan-out (0033),
-- agenda voting eligibility + anonymous-ballot scoping (0034), and
-- media_links sharing scope (0035).
--
-- Scenarios N-P (Phase 14.4): a broader adversarial security review
-- commissioned specifically for 14.4, sweeping every module 14.1 did not
-- already target, found two real, previously-unfound gaps and one lower-
-- severity one, fixed in 0040 and covered here: the workflow-governed-
-- status guard only ever examined transitions FROM the one specific
-- status each table's service layer happens to sync from, so a direct
-- write could skip straight from an EARLIER status to an approval outcome
-- without ever touching the examined "from" status at all (Scenario N);
-- event_attendance.recorded_by had no WITH CHECK at all, the identical bug
-- 0038 already fixed on the sibling attendance table (Scenario O); and
-- procurement_requests could be created against a non-approved expense
-- request via a direct write, bypassing an app-layer-only precondition
-- (Scenario P).
--
-- A regression in any of these re-opens a real authorization gap that
-- already shipped once — this suite exists so the next one is caught by
-- CI, not by a third manual verification pass.
--
-- USAGE: run via scripts/db-smoke-test.sh (which applies migrations +
-- reference seed to a scratch database first) — never against a database
-- holding real data; this file inserts throwaway fixture rows (prefixed
-- `SMOKE_`/fixed test UUIDs) and does not clean up after itself.
--
-- MECHANICS: fixtures are inserted as the `postgres` superuser (bypasses
-- RLS, same as every SECURITY DEFINER function in this schema). Each
-- assertion then does `set role authenticated; set app.current_user_id =
-- '<uuid>';` to simulate that specific user's session — mirroring this
-- project's own established manual-testing pattern — before `reset role;`
-- returns to the superuser for the next fixture batch. Every assertion is a
-- DO block: an expected-blocked write either raises the guard's own
-- SQLSTATE (caught and reported PASS) or is silently filtered by a bare
-- RLS USING clause (0 rows affected, checked explicitly) — an
-- expected-allowed write is checked to have actually applied. Any
-- assertion that doesn't hold raises a plain `ASSERTION FAILED` exception,
-- which — combined with `psql -v ON_ERROR_STOP=1` — fails this script's
-- exit code, exactly like a migration failing to apply.
-- ============================================================================

set client_min_messages to notice;

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------

insert into public.departments (id, name) values
  ('a0000000-0000-0000-0000-00000000d001', 'SMOKE_Department')
on conflict (id) do nothing;

-- auth.users + public.users for one holder of each permission this suite exercises.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000a1', 'smoke.secretary@example.test'),
  ('a0000000-0000-0000-0000-0000000000a2', 'smoke.finance@example.test'),
  ('a0000000-0000-0000-0000-0000000000a3', 'smoke.technical@example.test'),
  ('a0000000-0000-0000-0000-0000000000a4', 'smoke.hr@example.test'),
  ('a0000000-0000-0000-0000-0000000000a5', 'smoke.membera@example.test'),
  ('a0000000-0000-0000-0000-0000000000a6', 'smoke.memberb@example.test'),
  -- Phase 14.4 additions: one holder each of two permissions no earlier
  -- fixture user holds, needed for Scenarios I/K/M below.
  ('a0000000-0000-0000-0000-0000000000a7', 'smoke.discipline@example.test'),
  ('a0000000-0000-0000-0000-0000000000a8', 'smoke.pro@example.test')
on conflict (id) do nothing;

insert into public.users (id, display_name) values
  ('a0000000-0000-0000-0000-0000000000a1', 'SMOKE Secretary'),
  ('a0000000-0000-0000-0000-0000000000a2', 'SMOKE Finance Manager'),
  ('a0000000-0000-0000-0000-0000000000a3', 'SMOKE Technical Manager'),
  ('a0000000-0000-0000-0000-0000000000a4', 'SMOKE HR Deputy Secretary'),
  ('a0000000-0000-0000-0000-0000000000a5', 'SMOKE Member A'),
  ('a0000000-0000-0000-0000-0000000000a6', 'SMOKE Member B'),
  ('a0000000-0000-0000-0000-0000000000a7', 'SMOKE Discipline Manager'),
  ('a0000000-0000-0000-0000-0000000000a8', 'SMOKE PRO Spokesperson')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select u.id, r.id from (values
  ('a0000000-0000-0000-0000-0000000000a1'::uuid, 'secretary'),
  ('a0000000-0000-0000-0000-0000000000a2'::uuid, 'finance_manager'),
  ('a0000000-0000-0000-0000-0000000000a3'::uuid, 'technical_manager'),
  ('a0000000-0000-0000-0000-0000000000a4'::uuid, 'hr_deputy_secretary'),
  ('a0000000-0000-0000-0000-0000000000a5'::uuid, 'choir_member'),
  ('a0000000-0000-0000-0000-0000000000a6'::uuid, 'choir_member'),
  ('a0000000-0000-0000-0000-0000000000a7'::uuid, 'discipline_manager'),
  ('a0000000-0000-0000-0000-0000000000a8'::uuid, 'pro_spokesperson')
) as u(id, role_code)
join public.roles r on r.code = u.role_code
on conflict do nothing;

insert into public.members (id, member_number, user_id, first_name, last_name, membership_status, primary_department_id) values
  ('a0000000-0000-0000-0000-00000000b0a1', 'SMOKE-M-001', 'a0000000-0000-0000-0000-0000000000a5', 'Smoke', 'MemberA', 'active', 'a0000000-0000-0000-0000-00000000d001'),
  ('a0000000-0000-0000-0000-00000000b0a2', 'SMOKE-M-002', 'a0000000-0000-0000-0000-0000000000a6', 'Smoke', 'MemberB', 'active', 'a0000000-0000-0000-0000-00000000d001')
on conflict (id) do nothing;

insert into public.events (id, name, event_date) values
  ('a0000000-0000-0000-0000-00000000e001', 'SMOKE Event', current_date + 7)
on conflict (id) do nothing;

insert into public.event_participants (event_id, member_id)
values ('a0000000-0000-0000-0000-00000000e001', 'a0000000-0000-0000-0000-00000000b0a1')
on conflict do nothing;

do $$
begin
  raise notice '==== Fixtures loaded ====';
end;
$$;

-- ----------------------------------------------------------------------------
-- Scenario A: Invitations workflow-bypass guard (0036) + declined/rejected fix
-- ----------------------------------------------------------------------------

insert into public.invitations (
  id, invitation_number, organizer_name, event_name, proposed_date,
  access_token_hash, verification_contact, status
) values (
  'a0000000-0000-0000-0000-00000000c0a1', 'SMOKE-INV-001', 'Smoke Organizer', 'Smoke Event',
  current_date + 30, 'smoke-hash', 'smoke@example.test', 'pending_management_approval'
) on conflict (id) do update set status = 'pending_management_approval';

-- A1: a permission holder (secretary) directly forging "approved" with no
-- matching workflow_instances row must be blocked by the guard trigger.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
begin
  begin
    update public.invitations set status = 'approved' where id = 'a0000000-0000-0000-0000-00000000c0a1';
  exception when sqlstate '42501' then
    raise notice 'PASS (A1): forged invitation approval with no workflow_instances row was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (A1): forged invitation approval succeeded with no workflow_instances row';
end;
$$;
reset role;
reset app.current_user_id;

-- A2: once a real workflow_instances row reflects an approved outcome, the
-- same sync-update must succeed.
insert into public.workflow_instances (id, workflow_definition_id, record_type, record_id, status)
select 'a0000000-0000-0000-0000-00000000f0a1', wd.id, 'invitation', 'a0000000-0000-0000-0000-00000000c0a1', 'approved'
from public.workflow_definitions wd where wd.record_type = 'invitation'
limit 1
on conflict (id) do update set status = 'approved';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_status text;
begin
  update public.invitations set status = 'approved' where id = 'a0000000-0000-0000-0000-00000000c0a1' returning status into v_status;
  if v_status is distinct from 'approved' then
    raise exception 'ASSERTION FAILED (A2): expected invitation approval sync to succeed once workflow_instances reflects approved, got %', v_status;
  end if;
  raise notice 'PASS (A2): invitation approval sync succeeded once workflow_instances reflected approved';
end;
$$;
reset role;
reset app.current_user_id;

-- A3: the declined/rejected vocabulary mismatch regression test — a fresh
-- invitation, workflow_instances rejected, must allow status='declined'.
insert into public.invitations (
  id, invitation_number, organizer_name, event_name, proposed_date,
  access_token_hash, verification_contact, status
) values (
  'a0000000-0000-0000-0000-00000000c0a2', 'SMOKE-INV-002', 'Smoke Organizer', 'Smoke Event 2',
  current_date + 31, 'smoke-hash-2', 'smoke2@example.test', 'pending_management_approval'
) on conflict (id) do update set status = 'pending_management_approval';

insert into public.workflow_instances (id, workflow_definition_id, record_type, record_id, status)
select 'a0000000-0000-0000-0000-00000000f0a2', wd.id, 'invitation', 'a0000000-0000-0000-0000-00000000c0a2', 'rejected'
from public.workflow_definitions wd where wd.record_type = 'invitation'
limit 1
on conflict (id) do update set status = 'rejected';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_status text;
begin
  update public.invitations set status = 'declined' where id = 'a0000000-0000-0000-0000-00000000c0a2' returning status into v_status;
  if v_status is distinct from 'declined' then
    raise exception 'ASSERTION FAILED (A3): expected invitation decline sync to succeed once workflow_instances reflects rejected (declined/rejected regression), got %', v_status;
  end if;
  raise notice 'PASS (A3): invitation decline sync succeeded (declined/rejected vocabulary regression test)';
end;
$$;
reset role;
reset app.current_user_id;

-- A4: the always-allowed exit — cancelInvitation — must succeed with NO
-- workflow_instances row at all.
insert into public.invitations (
  id, invitation_number, organizer_name, event_name, proposed_date,
  access_token_hash, verification_contact, status
) values (
  'a0000000-0000-0000-0000-00000000c0a3', 'SMOKE-INV-003', 'Smoke Organizer', 'Smoke Event 3',
  current_date + 32, 'smoke-hash-3', 'smoke3@example.test', 'pending_management_approval'
) on conflict (id) do update set status = 'pending_management_approval';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_status text;
begin
  update public.invitations set status = 'cancelled' where id = 'a0000000-0000-0000-0000-00000000c0a3' returning status into v_status;
  if v_status is distinct from 'cancelled' then
    raise exception 'ASSERTION FAILED (A4): expected cancelInvitation''s always-allowed exit to succeed, got %', v_status;
  end if;
  raise notice 'PASS (A4): always-allowed cancellation exit succeeded with no workflow_instances row';
end;
$$;
reset role;
reset app.current_user_id;

-- A5: an exit that is neither a verified workflow outcome nor allowlisted
-- must still be blocked (the "skip approval entirely" bug class).
insert into public.invitations (
  id, invitation_number, organizer_name, event_name, proposed_date,
  access_token_hash, verification_contact, status
) values (
  'a0000000-0000-0000-0000-00000000c0a4', 'SMOKE-INV-004', 'Smoke Organizer', 'Smoke Event 4',
  current_date + 33, 'smoke-hash-4', 'smoke4@example.test', 'pending_management_approval'
) on conflict (id) do update set status = 'pending_management_approval';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
begin
  begin
    update public.invitations set status = 'completed' where id = 'a0000000-0000-0000-0000-00000000c0a4';
  exception when sqlstate '42501' then
    raise notice 'PASS (A5): unrecognized direct exit from pending_management_approval was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (A5): unrecognized direct exit from pending_management_approval succeeded — approval skip-entirely regression';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario B: Expense request workflow-bypass guard (0036)
-- ----------------------------------------------------------------------------

insert into public.expense_requests (id, request_number, requested_by, description, amount, status)
values ('a0000000-0000-0000-0000-0000000010a1', 'SMOKE-EXP-001', 'a0000000-0000-0000-0000-0000000000a5', 'Smoke expense', 100.00, 'pending_approval')
on conflict (id) do update set status = 'pending_approval';

-- B1: finance_manager forging approved directly with no workflow_instances row.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
begin
  begin
    update public.expense_requests set status = 'approved' where id = 'a0000000-0000-0000-0000-0000000010a1';
  exception when sqlstate '42501' then
    raise notice 'PASS (B1): forged expense approval with no workflow_instances row was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (B1): forged expense approval succeeded with no workflow_instances row';
end;
$$;
reset role;
reset app.current_user_id;

-- B2: the "skip approval entirely" attempt — pending_approval -> paid
-- directly (not a guarded pair, not allowlisted) must be blocked.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
begin
  begin
    update public.expense_requests set status = 'paid' where id = 'a0000000-0000-0000-0000-0000000010a1';
  exception when sqlstate '42501' then
    raise notice 'PASS (B2): direct pending_approval -> paid skip-entirely attempt was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (B2): direct pending_approval -> paid skip-entirely attempt succeeded';
end;
$$;
reset role;
reset app.current_user_id;

-- B3: once workflow_instances reflects approved, the sync-update succeeds.
insert into public.workflow_instances (id, workflow_definition_id, record_type, record_id, status)
select 'a0000000-0000-0000-0000-00000000f0a3', wd.id, 'expense_request', 'a0000000-0000-0000-0000-0000000010a1', 'approved'
from public.workflow_definitions wd where wd.record_type = 'expense_request'
limit 1
on conflict (id) do update set status = 'approved';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
declare
  v_status text;
begin
  update public.expense_requests set status = 'approved' where id = 'a0000000-0000-0000-0000-0000000010a1' returning status into v_status;
  if v_status is distinct from 'approved' then
    raise exception 'ASSERTION FAILED (B3): expected expense approval sync to succeed once workflow_instances reflects approved, got %', v_status;
  end if;
  raise notice 'PASS (B3): expense approval sync succeeded once workflow_instances reflected approved';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario C: Gate pass workflow-bypass guard — the exact bug this phase's
-- own manual testing caught (pending_approval -> checked_out skipping
-- approval entirely, performed by the person_responsible_id holder who
-- needs no special permission at all).
-- ----------------------------------------------------------------------------

insert into public.gate_passes (id, gate_pass_number, event_id, person_responsible_id, status)
values ('a0000000-0000-0000-0000-0000000020a1', 'SMOKE-GP-001', 'a0000000-0000-0000-0000-00000000e001', 'a0000000-0000-0000-0000-0000000000a5', 'pending_approval')
on conflict (id) do update set status = 'pending_approval';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
begin
  begin
    update public.gate_passes set status = 'checked_out' where id = 'a0000000-0000-0000-0000-0000000020a1';
  exception when sqlstate '42501' then
    raise notice 'PASS (C1): person_responsible_id skipping approval (pending_approval -> checked_out) was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (C1): person_responsible_id skipped approval entirely (pending_approval -> checked_out) — this is the exact regression Phase 14.1''s manual testing caught';
end;
$$;
reset role;
reset app.current_user_id;

-- C2: once approved for real, the same person_responsible_id can check out
-- (this transition is intentionally outside the guard's "from" status —
-- gate_passes_write_scoped is the only gate on it).
insert into public.workflow_instances (id, workflow_definition_id, record_type, record_id, status)
select 'a0000000-0000-0000-0000-00000000f0a4', wd.id, 'gate_pass', 'a0000000-0000-0000-0000-0000000020a1', 'approved'
from public.workflow_definitions wd where wd.record_type = 'gate_pass'
limit 1
on conflict (id) do update set status = 'approved';

update public.gate_passes set status = 'pending_approval' where id = 'a0000000-0000-0000-0000-0000000020a1';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
declare
  v_status text;
begin
  update public.gate_passes set status = 'approved' where id = 'a0000000-0000-0000-0000-0000000020a1' returning status into v_status;
  if v_status is distinct from 'approved' then
    raise exception 'ASSERTION FAILED (C2 setup): expected gate pass approval sync to succeed once workflow_instances reflects approved, got %', v_status;
  end if;
  update public.gate_passes set status = 'checked_out' where id = 'a0000000-0000-0000-0000-0000000020a1' returning status into v_status;
  if v_status is distinct from 'checked_out' then
    raise exception 'ASSERTION FAILED (C2): expected legitimate post-approval checkout to succeed, got %', v_status;
  end if;
  raise notice 'PASS (C2): legitimate post-approval checkout succeeded';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario D: Procurement request state-machine guard (0036 Part 3)
-- ----------------------------------------------------------------------------

insert into public.expense_requests (id, request_number, requested_by, description, amount, status)
values ('a0000000-0000-0000-0000-0000000010a2', 'SMOKE-EXP-002', 'a0000000-0000-0000-0000-0000000000a5', 'Smoke procurement expense', 500.00, 'approved')
on conflict (id) do update set status = 'approved';

insert into public.procurement_requests (id, expense_request_id, description, status)
values ('a0000000-0000-0000-0000-0000000030a1', 'a0000000-0000-0000-0000-0000000010a2', 'Smoke procurement', 'pending')
on conflict (id) do update set status = 'pending';

-- D1: pending -> purchased directly (skipping vendor_selected) must be blocked.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
begin
  begin
    update public.procurement_requests set status = 'purchased' where id = 'a0000000-0000-0000-0000-0000000030a1';
  exception when sqlstate '22023' then
    raise notice 'PASS (D1): procurement pending -> purchased (skipping vendor_selected) was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (D1): procurement pending -> purchased succeeded, skipping vendor_selected';
end;
$$;
reset role;
reset app.current_user_id;

-- D2: pending -> vendor_selected -> purchased (the legal path) succeeds.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
declare
  v_status text;
begin
  update public.procurement_requests set status = 'vendor_selected' where id = 'a0000000-0000-0000-0000-0000000030a1' returning status into v_status;
  if v_status is distinct from 'vendor_selected' then
    raise exception 'ASSERTION FAILED (D2a): expected pending -> vendor_selected to succeed, got %', v_status;
  end if;
  update public.procurement_requests set status = 'purchased' where id = 'a0000000-0000-0000-0000-0000000030a1' returning status into v_status;
  if v_status is distinct from 'purchased' then
    raise exception 'ASSERTION FAILED (D2b): expected vendor_selected -> purchased to succeed, got %', v_status;
  end if;
  raise notice 'PASS (D2): legal procurement path pending -> vendor_selected -> purchased succeeded';
end;
$$;
reset role;
reset app.current_user_id;

-- D3: a terminal purchased request must never be resurrected.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
begin
  begin
    update public.procurement_requests set status = 'pending' where id = 'a0000000-0000-0000-0000-0000000030a1';
  exception when sqlstate '22023' then
    raise notice 'PASS (D3): resurrecting a terminal purchased procurement request was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (D3): a terminal purchased procurement request was resurrected to pending';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario E: workflow_instances insert-only narrowing (0036 Part 1)
-- ----------------------------------------------------------------------------

-- E1: even a management.approvals.manage holder (secretary) cannot directly
-- UPDATE workflow_instances any more — only record_workflow_decision()
-- (SECURITY DEFINER, bypasses RLS) can. No UPDATE policy exists at all, so
-- this is a silent 0-row no-op, not a raised exception.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_rows int;
begin
  update public.workflow_instances set status = 'cancelled' where id = 'a0000000-0000-0000-0000-00000000f0a1';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'ASSERTION FAILED (E1): a direct UPDATE on workflow_instances affected % row(s) — insert-only narrowing has regressed', v_rows;
  end if;
  raise notice 'PASS (E1): direct UPDATE on workflow_instances affected 0 rows (insert-only narrowing holds)';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario F: playlists shared_with_roles enforcement (0037)
-- ----------------------------------------------------------------------------

insert into public.playlists (id, event_id, title, shared_with_roles)
values ('a0000000-0000-0000-0000-000000040a01', 'a0000000-0000-0000-0000-00000000e001', 'SMOKE Playlist', array['hr_deputy_secretary'])
on conflict (id) do update set shared_with_roles = array['hr_deputy_secretary'];

-- F1: a holder of a role listed in shared_with_roles, who is neither a
-- participant nor a technical.playlists.manage holder, can read it.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a4';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.playlists where id = 'a0000000-0000-0000-0000-000000040a01') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (F1): a role-shared playlist was not visible to a holder of a listed role';
  end if;
  raise notice 'PASS (F1): role-shared playlist visible to a holder of a shared_with_roles role';
end;
$$;
reset role;
reset app.current_user_id;

-- F2: member B (not a participant, no shared role, no manage permission)
-- cannot read it.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a6';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.playlists where id = 'a0000000-0000-0000-0000-000000040a01') into v_found;
  if v_found then
    raise exception 'ASSERTION FAILED (F2): an outsider with no participation/shared role/manage permission could read the playlist';
  end if;
  raise notice 'PASS (F2): outsider correctly cannot read the playlist';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario G: event_participants read scoping narrowed to own rows (0037)
-- ----------------------------------------------------------------------------

-- G1: member A can see their own event_participants row.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.event_participants where event_id = 'a0000000-0000-0000-0000-00000000e001' and member_id = 'a0000000-0000-0000-0000-00000000b0a1') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (G1): member A could not see their own event_participants row';
  end if;
  raise notice 'PASS (G1): member A can see their own event_participants row';
end;
$$;
reset role;
reset app.current_user_id;

-- G2: member B (not a participant, no events.eligibility.manage) cannot see
-- member A's event_participants row.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a6';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.event_participants where event_id = 'a0000000-0000-0000-0000-00000000e001' and member_id = 'a0000000-0000-0000-0000-00000000b0a1') into v_found;
  if v_found then
    raise exception 'ASSERTION FAILED (G2): an unrelated member could see another member''s event_participants row';
  end if;
  raise notice 'PASS (G2): an unrelated member correctly cannot see another member''s event_participants row';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario H: attendance recorded_by WITH CHECK (0038)
-- ----------------------------------------------------------------------------

insert into public.attendance_sessions (id, session_type, title, department_id, session_date)
values ('a0000000-0000-0000-0000-0000000050a1', 'rehearsal', 'SMOKE Session', 'a0000000-0000-0000-0000-00000000d001', current_date)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id, scope_type, scope_id)
select 'a0000000-0000-0000-0000-0000000000a6', r.id, 'department', 'a0000000-0000-0000-0000-00000000d001'
from public.roles r where r.code = 'department_leader'
on conflict do nothing;

-- H1: a department-scoped leader (member B, scoped to SMOKE_Department) can
-- record attendance as themself.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a6';
do $$
begin
  insert into public.attendance (session_id, member_id, status_code, recorded_by)
  values ('a0000000-0000-0000-0000-0000000050a1', 'a0000000-0000-0000-0000-00000000b0a1', 'present', 'a0000000-0000-0000-0000-0000000000a6');
  raise notice 'PASS (H1): department-scoped leader recording attendance as themself succeeded';
exception when others then
  raise exception 'ASSERTION FAILED (H1): legitimate self-recorded attendance was blocked (%: %)', sqlstate, sqlerrm;
end;
$$;
reset role;
reset app.current_user_id;

-- H2: the same leader cannot forge recorded_by as someone else.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a6';
do $$
begin
  begin
    insert into public.attendance (session_id, member_id, status_code, recorded_by)
    values ('a0000000-0000-0000-0000-0000000050a1', 'a0000000-0000-0000-0000-00000000b0a2', 'present', 'a0000000-0000-0000-0000-0000000000a1');
  exception when sqlstate '42501' or sqlstate '44000' then
    raise notice 'PASS (H2): forging recorded_by as another user was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (H2): forging attendance.recorded_by as another user succeeded';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario I: Discipline member access scoping (0026) — Phase 14.4 addition,
-- extending coverage beyond Phase 14.1's own six fixes into an earlier
-- phase's own security-review fix that never got automated DB-layer
-- coverage (docs/PHASE_14_2.md §7 named this class of gap explicitly).
-- ----------------------------------------------------------------------------

insert into public.disciplinary_cases (id, case_number, member_id, category, incident_date, description, officer_id, status)
values (
  'a0000000-0000-0000-0000-0000000060a1', 'SMOKE-DISC-001', 'a0000000-0000-0000-0000-00000000b0a1',
  'conduct', current_date - 5, 'Smoke disciplinary case', 'a0000000-0000-0000-0000-0000000000a7', 'open'
) on conflict (id) do nothing;

-- I1: a discipline.cases.read holder can see the profile of a member who IS
-- the subject of an existing case.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a7';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.members where id = 'a0000000-0000-0000-0000-00000000b0a1') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (I1): a discipline.cases.read holder could not see a member with a case on file';
  end if;
  raise notice 'PASS (I1): discipline.cases.read holder can see a member with a case on file';
end;
$$;
reset role;
reset app.current_user_id;

-- I2: the same discipline.cases.read holder CANNOT see a member with NO
-- case on file via this same table — scoped, not a blanket grant.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a7';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.members where id = 'a0000000-0000-0000-0000-00000000b0a2') into v_found;
  if v_found then
    raise exception 'ASSERTION FAILED (I2): a discipline.cases.read holder could see a member with NO case on file — members_select_discipline_scoped has regressed into a blanket grant';
  end if;
  raise notice 'PASS (I2): discipline.cases.read holder correctly cannot see a member with no case on file';
end;
$$;
reset role;
reset app.current_user_id;

-- I3: find_member_by_number_for_discipline() refuses a caller who does not
-- hold discipline.cases.manage, even for an exact member_number match —
-- the "not a backdoor directory" guarantee (0026's own file header).
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
declare
  v_rows int;
begin
  select count(*) into v_rows from public.find_member_by_number_for_discipline('SMOKE-M-002');
  if v_rows <> 0 then
    raise exception 'ASSERTION FAILED (I3): find_member_by_number_for_discipline returned % row(s) for a caller with no discipline.cases.manage', v_rows;
  end if;
  raise notice 'PASS (I3): find_member_by_number_for_discipline correctly refuses a non-discipline-manager caller';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario J: Announcements select scope (0032) — Phase 14.4 addition.
-- ----------------------------------------------------------------------------

insert into public.announcements (id, title, message, author_id, target_audience, publish_at)
values (
  'a0000000-0000-0000-0000-0000000070a1', 'SMOKE Future Announcement', 'Smoke body',
  'a0000000-0000-0000-0000-0000000000a4', 'all', now() + interval '30 days'
) on conflict (id) do update set publish_at = now() + interval '30 days';

-- J1: the author (also a communications.announcements.manage holder here)
-- can read their own future-scheduled announcement before it goes live.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a4';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.announcements where id = 'a0000000-0000-0000-0000-0000000070a1') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (J1): the author could not read their own future-scheduled announcement';
  end if;
  raise notice 'PASS (J1): author can read their own future-scheduled (not-yet-live) announcement';
end;
$$;
reset role;
reset app.current_user_id;

-- J2: a plain member cannot see it before publish_at arrives.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.announcements where id = 'a0000000-0000-0000-0000-0000000070a1') into v_found;
  if v_found then
    raise exception 'ASSERTION FAILED (J2): a plain member could see a future-scheduled announcement before publish_at';
  end if;
  raise notice 'PASS (J2): a plain member correctly cannot see a not-yet-live announcement';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario K: send_notification RPC fans out beyond the caller (0033) —
-- Phase 14.4 addition. Both SMOKE Member A and B are seeded into
-- SMOKE_Department (fixtures above); a pro_spokesperson sender holds no
-- direct SELECT grant on either's users/members row (RLS-scoped to self)
-- outside this SECURITY DEFINER function.
-- ----------------------------------------------------------------------------

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a8';
do $$
declare
  v_rows int;
begin
  select count(*) into v_rows from public.send_notification(
    'department', 'a0000000-0000-0000-0000-00000000d001', null, null,
    'in_app', 'SMOKE Subject', 'SMOKE Body', null, null, null, null
  );
  if v_rows < 2 then
    raise exception 'ASSERTION FAILED (K1): send_notification fanned out to % row(s), expected at least 2 (SMOKE Member A and B) — the Phase 10.2 RLS-scoped-audience-resolution bug this RPC fixes may have regressed', v_rows;
  end if;
  raise notice 'PASS (K1): send_notification fanned a department-audience notification out to % recipients as a non-super_admin pro_spokesperson sender', v_rows;
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario L: Agenda voting eligibility + anonymous-ballot scoping (0034) —
-- Phase 14.4 addition.
-- ----------------------------------------------------------------------------

insert into public.agendas (id, title, eligible_voter_scope, eligible_user_ids, is_anonymous, voting_deadline, status, created_by)
values (
  'a0000000-0000-0000-0000-0000000080a1', 'SMOKE Agenda', 'specific_users',
  array['a0000000-0000-0000-0000-0000000000a5']::uuid[], true, now() + interval '7 days', 'open',
  'a0000000-0000-0000-0000-0000000000a1'
) on conflict (id) do update set status = 'open', voting_deadline = now() + interval '7 days';

-- L1: an eligible voter (member A, listed in eligible_user_ids) can cast a vote.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
begin
  insert into public.votes (agenda_id, voter_id, choice)
  values ('a0000000-0000-0000-0000-0000000080a1', 'a0000000-0000-0000-0000-0000000000a5', 'yes')
  on conflict (agenda_id, voter_id) do update set choice = 'yes';
  raise notice 'PASS (L1): an eligible voter (listed in eligible_user_ids) can cast a vote';
exception when others then
  raise exception 'ASSERTION FAILED (L1): a legitimately eligible voter was blocked (%: %)', sqlstate, sqlerrm;
end;
$$;
reset role;
reset app.current_user_id;

-- L2: an ineligible voter (member B, NOT listed) is blocked at the database
-- layer, not just hidden by client UI — the vote-integrity gap 0034 fixed.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a6';
do $$
begin
  begin
    insert into public.votes (agenda_id, voter_id, choice)
    values ('a0000000-0000-0000-0000-0000000080a1', 'a0000000-0000-0000-0000-0000000000a6', 'yes');
  exception when sqlstate '42501' then
    raise notice 'PASS (L2): an ineligible voter (not in eligible_user_ids) was blocked from casting a vote';
    return;
  end;
  raise exception 'ASSERTION FAILED (L2): an ineligible voter successfully cast a vote on a specific_users-scoped agenda — the vote-integrity regression 0034 fixed';
end;
$$;
reset role;
reset app.current_user_id;

-- L3: a management.agenda.manage holder (secretary) cannot read another
-- voter's raw ballot on an is_anonymous agenda — only the aggregate
-- agenda_results view (unaffected here) is meant to show anything.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_found boolean;
begin
  select exists(
    select 1 from public.votes
    where agenda_id = 'a0000000-0000-0000-0000-0000000080a1' and voter_id = 'a0000000-0000-0000-0000-0000000000a5'
  ) into v_found;
  if v_found then
    raise exception 'ASSERTION FAILED (L3): a management.agenda.manage holder (not Super Admin) could read a raw voter->choice row on an is_anonymous agenda';
  end if;
  raise notice 'PASS (L3): management.agenda.manage holder correctly cannot read a raw ballot on an anonymous agenda';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario M: media_links sharing-scope enforcement (0035) — Phase 14.4
-- addition, mirroring Scenario F's playlist pattern for the sibling fix.
-- ----------------------------------------------------------------------------

insert into public.media_links (id, link_type, url, shared_with_roles, is_published)
values (
  'a0000000-0000-0000-0000-0000000090a1', 'other', 'https://example.test/smoke',
  array['hr_deputy_secretary'], false
) on conflict (id) do update set shared_with_roles = array['hr_deputy_secretary'], is_published = false;

insert into public.media_links (id, link_type, url, shared_with_member_ids, is_published)
values (
  'a0000000-0000-0000-0000-0000000090a2', 'other', 'https://example.test/smoke2',
  array['a0000000-0000-0000-0000-00000000b0a1'::uuid], false
) on conflict (id) do update set shared_with_member_ids = array['a0000000-0000-0000-0000-00000000b0a1'::uuid], is_published = false;

-- M1: a holder of a role listed in shared_with_roles can read an unpublished item.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a4';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.media_links where id = 'a0000000-0000-0000-0000-0000000090a1') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (M1): a role-shared unpublished media link was not visible to a holder of a listed role';
  end if;
  raise notice 'PASS (M1): role-shared unpublished media link visible to a holder of a shared_with_roles role';
end;
$$;
reset role;
reset app.current_user_id;

-- M2: an outsider (member B) cannot read either unpublished item.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a6';
do $$
declare
  v_found1 boolean;
  v_found2 boolean;
begin
  select exists(select 1 from public.media_links where id = 'a0000000-0000-0000-0000-0000000090a1') into v_found1;
  select exists(select 1 from public.media_links where id = 'a0000000-0000-0000-0000-0000000090a2') into v_found2;
  if v_found1 or v_found2 then
    raise exception 'ASSERTION FAILED (M2): an outsider with no shared role/member-id/manage permission could read an unpublished media link';
  end if;
  raise notice 'PASS (M2): outsider correctly cannot read either unpublished, unshared-with-them media link';
end;
$$;
reset role;
reset app.current_user_id;

-- M3: a member listed directly in shared_with_member_ids can read that item.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a5';
do $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.media_links where id = 'a0000000-0000-0000-0000-0000000090a2') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (M3): a member listed in shared_with_member_ids could not read the unpublished media link shared with them';
  end if;
  raise notice 'PASS (M3): member listed in shared_with_member_ids can read the unpublished item shared with them';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario N: 0040's broadened workflow-governed-status guard — closes the
-- "skip straight to approved from an EARLY status, never touching the one
-- specific guarded 'from' status" bypass Phase 14.4's own security review
-- found on invitations and expense_requests.
-- ----------------------------------------------------------------------------

insert into public.invitations (
  id, invitation_number, organizer_name, event_name, proposed_date,
  access_token_hash, verification_contact, status
) values (
  'a0000000-0000-0000-0000-00000000c0a5', 'SMOKE-INV-005', 'Smoke Organizer', 'Smoke Event 5',
  current_date + 34, 'smoke-hash-5', 'smoke5@example.test', 'draft'
) on conflict (id) do update set status = 'draft';

-- N1: a direct jump from 'draft' (never touching pending_management_approval
-- at all) straight to 'approved', with no workflow_instances row, must be
-- blocked — before 0040 this was NOT examined by the guard at all.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a1';
do $$
begin
  begin
    update public.invitations set status = 'approved' where id = 'a0000000-0000-0000-0000-00000000c0a5';
  exception when sqlstate '42501' then
    raise notice 'PASS (N1): direct draft -> approved jump on an invitation (skipping pending_management_approval entirely) was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (N1): an invitation was forged straight from draft to approved, never passing through pending_management_approval — the exact bypass 0040 closes';
end;
$$;
reset role;
reset app.current_user_id;

insert into public.expense_requests (id, request_number, requested_by, description, amount, status)
values ('a0000000-0000-0000-0000-0000000010a3', 'SMOKE-EXP-003', 'a0000000-0000-0000-0000-0000000000a5', 'Smoke expense 3', 200.00, 'draft')
on conflict (id) do update set status = 'draft';

-- N2: same bypass, expense_requests: 'draft' straight to 'approved'.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
begin
  begin
    update public.expense_requests set status = 'approved' where id = 'a0000000-0000-0000-0000-0000000010a3';
  exception when sqlstate '42501' then
    raise notice 'PASS (N2): direct draft -> approved jump on an expense request (skipping pending_approval entirely) was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (N2): an expense request was forged straight from draft to approved, never passing through pending_approval — the exact bypass 0040 closes';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario O: event_attendance.recorded_by WITH CHECK (0040) — sibling of
-- Scenario H's attendance fix, applied to the on-the-day event_attendance
-- table Phase 14.1 did not touch.
-- ----------------------------------------------------------------------------

-- O1: an attendance.records.manage holder (HR) can record event attendance
-- as themself.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a4';
do $$
begin
  insert into public.event_attendance (event_id, member_id, status_code, recorded_by)
  values ('a0000000-0000-0000-0000-00000000e001', 'a0000000-0000-0000-0000-00000000b0a1', 'present', 'a0000000-0000-0000-0000-0000000000a4');
  raise notice 'PASS (O1): attendance.records.manage holder recording event attendance as themself succeeded';
exception when others then
  raise exception 'ASSERTION FAILED (O1): legitimate self-recorded event attendance was blocked (%: %)', sqlstate, sqlerrm;
end;
$$;
reset role;
reset app.current_user_id;

-- O2: the same holder cannot forge recorded_by as someone else.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a4';
do $$
begin
  begin
    insert into public.event_attendance (event_id, member_id, status_code, recorded_by)
    values ('a0000000-0000-0000-0000-00000000e001', 'a0000000-0000-0000-0000-00000000b0a2', 'present', 'a0000000-0000-0000-0000-0000000000a1');
  exception when sqlstate '42501' or sqlstate '44000' then
    raise notice 'PASS (O2): forging event_attendance.recorded_by as another user was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (O2): forging event_attendance.recorded_by as another user succeeded — the sibling of the bug 0038 fixed on attendance, now also closed on event_attendance by 0040';
end;
$$;
reset role;
reset app.current_user_id;

-- ----------------------------------------------------------------------------
-- Scenario P: procurement_requests insert-time approved-expense-request
-- linkage guard (0040) — a lower-severity, insert-time integrity fix.
-- ----------------------------------------------------------------------------

insert into public.expense_requests (id, request_number, requested_by, description, amount, status)
values ('a0000000-0000-0000-0000-0000000010a4', 'SMOKE-EXP-004', 'a0000000-0000-0000-0000-0000000000a5', 'Smoke expense 4 (not approved)', 300.00, 'draft')
on conflict (id) do update set status = 'draft';

-- P1: a finance.procurement.manage holder cannot create a procurement
-- request against an expense request that is not (yet) approved.
set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
begin
  begin
    insert into public.procurement_requests (expense_request_id, description, status)
    values ('a0000000-0000-0000-0000-0000000010a4', 'Smoke procurement (should be blocked)', 'pending');
  exception when sqlstate '42501' then
    raise notice 'PASS (P1): creating a procurement request against a non-approved (draft) expense request was blocked';
    return;
  end;
  raise exception 'ASSERTION FAILED (P1): a procurement request was created against a draft (not approved) expense request — the insert-time linkage bypass 0040 closes';
end;
$$;
reset role;
reset app.current_user_id;

-- P2: the legitimate case — an already-approved expense request — still
-- allows procurement creation (positive-path regression guard for 0040's
-- own fix, isolated from Scenario D's fixtures).
insert into public.expense_requests (id, request_number, requested_by, description, amount, status)
values ('a0000000-0000-0000-0000-0000000010a5', 'SMOKE-EXP-005', 'a0000000-0000-0000-0000-0000000000a5', 'Smoke expense 5 (approved)', 400.00, 'approved')
on conflict (id) do update set status = 'approved';

set role authenticated;
set app.current_user_id = 'a0000000-0000-0000-0000-0000000000a2';
do $$
declare
  v_found boolean;
begin
  insert into public.procurement_requests (id, expense_request_id, description, status)
  values ('a0000000-0000-0000-0000-0000000030a2', 'a0000000-0000-0000-0000-0000000010a5', 'Smoke procurement (should succeed)', 'pending')
  on conflict (id) do nothing;
  select exists(select 1 from public.procurement_requests where id = 'a0000000-0000-0000-0000-0000000030a2') into v_found;
  if not v_found then
    raise exception 'ASSERTION FAILED (P2): a procurement request against a genuinely approved expense request was blocked';
  end if;
  raise notice 'PASS (P2): procurement request creation against an approved expense request still succeeds';
end;
$$;
reset role;
reset app.current_user_id;

do $$
begin
  raise notice '==== ALL SMOKE ASSERTIONS PASSED ====';
end;
$$;
