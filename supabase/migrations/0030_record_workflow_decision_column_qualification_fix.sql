-- ============================================================================
-- 0030_record_workflow_decision_column_qualification_fix.sql
-- Phase 8.3 (Gate Pass). Fixes a real, pre-existing bug in
-- 0028_workflow_decision_function.sql's `record_workflow_decision` —
-- untested against a real Postgres instance since Phase 7.5, since neither
-- the Playwright e2e mock server (a hand-written JS re-implementation of
-- the state machine, not this actual SQL) nor the @ngc/services unit-test
-- fake client (same) model plpgsql variable/column name resolution. This
-- phase is the first to run its own new function's logic against a live
-- local Postgres instance (`scripts/db-migrate.sh` + manual RPC calls) to
-- validate it before shipping — doing that immediately surfaced the
-- identical defect already sitting in 0028, one migration prior.
--
-- THE BUG: `record_workflow_decision`'s RETURNS TABLE clause declares OUT
-- parameters named `id`, `status`, `current_step_order`, `record_type`,
-- and `record_id`. plpgsql's default `variable_conflict = error` behavior
-- treats any BARE reference to a column with the same name, anywhere in
-- the function body, as ambiguous against that OUT parameter — not just in
-- the final `return query`, which already (correctly) qualifies every
-- column via the `wi.` alias. Every OTHER `where id = p_workflow_instance_
-- id` in the function — the initial `select ... for update`, and all three
-- `update ... where id = ...` statements — was left unqualified, so EVERY
-- real call raises `column reference "id" is ambiguous` before it can do
-- anything: the function has never actually been able to record a
-- workflow decision against real Postgres. Confirmed by running it
-- directly against a live local instance: `select * from record_workflow_
-- decision(<uuid>, 'approve', null)` fails immediately with that error,
-- on the very first `select ... into v_instance` line.
--
-- IMPACT: this is the ONLY write path for advancing a `workflow_instances`
-- row (0028's own comment) — so Invitations' entire approval-chain
-- decision flow (Phase 7.5) has been non-functional against a real
-- database since it shipped, despite passing every unit test and e2e test,
-- because neither test surface actually exercises this SQL function's own
-- text. Gate Pass (Phase 8.3, this same migration set) would have shipped
-- with the identical defect in its own new `start_gate_pass_workflow`
-- (0029) had it not been caught the same way, before it was ever run
-- against real Postgres.
--
-- THE FIX: `create or replace function` with every WHERE-clause `id`
-- reference qualified as `workflow_instances.id`. No other change — same
-- signature, same logic, same comment/grant. A regression test belongs at
-- the database-integration layer this codebase does not yet have
-- automated (see docs/PHASE_8_3.md §4/§7 for why this is flagged as an
-- open gap rather than silently left unaddressed: this codebase's unit
-- tests and e2e tests, by design, do not execute real SQL function bodies
-- against a real Postgres instance).
-- ============================================================================

create or replace function public.record_workflow_decision(
  p_workflow_instance_id uuid,
  p_decision text,
  p_comment text default null
) returns table (
  id uuid,
  status text,
  current_step_order int,
  record_type text,
  record_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance record;
  v_step record;
  v_matched_role text;
  v_max_step int;
begin
  if p_decision not in ('approve', 'reject', 'request_changes') then
    raise exception 'Invalid workflow decision "%"', p_decision using errcode = '22023';
  end if;

  select * into v_instance from public.workflow_instances where workflow_instances.id = p_workflow_instance_id for update;
  if v_instance is null then
    raise exception 'Workflow instance not found' using errcode = '22023';
  end if;
  if v_instance.status <> 'pending' then
    raise exception 'This workflow is no longer awaiting a decision' using errcode = '22023';
  end if;

  select * into v_step from public.workflow_definition_steps
    where workflow_definition_id = v_instance.workflow_definition_id
      and step_order = v_instance.current_step_order;
  if v_step is null then
    raise exception 'The current workflow step is not configured' using errcode = '22023';
  end if;

  if v_step.required_user_id is not null and v_step.required_user_id = auth.uid() then
    v_matched_role := v_step.required_role_code;
  elsif v_step.required_role_code is not null and public.has_role(v_step.required_role_code) then
    v_matched_role := v_step.required_role_code;
  else
    raise exception 'You are not the required approver for the current step' using errcode = '42501';
  end if;

  insert into public.workflow_step_decisions
    (workflow_instance_id, step_order, approver_id, approver_role_code, decision, comment)
  values
    (p_workflow_instance_id, v_instance.current_step_order, auth.uid(), v_matched_role, p_decision, p_comment);

  if p_decision = 'reject' then
    update public.workflow_instances set status = 'rejected' where workflow_instances.id = p_workflow_instance_id;
  elsif p_decision = 'request_changes' then
    -- Recorded as a fact only; the instance stays 'pending' at the SAME
    -- step, so once the requester addresses it and the module resumes the
    -- approval, the same approver reviews again rather than restarting
    -- the whole chain from step 1. See docs/PHASE_7_5.md §2.3.
    null;
  else
    select max(step_order) into v_max_step from public.workflow_definition_steps
      where workflow_definition_id = v_instance.workflow_definition_id;
    if v_instance.current_step_order >= v_max_step then
      update public.workflow_instances set status = 'approved' where workflow_instances.id = p_workflow_instance_id;
    else
      update public.workflow_instances set current_step_order = v_instance.current_step_order + 1
        where workflow_instances.id = p_workflow_instance_id;
    end if;
  end if;

  return query
    select wi.id, wi.status, wi.current_step_order, wi.record_type, wi.record_id
    from public.workflow_instances wi
    where wi.id = p_workflow_instance_id;
end;
$$;

comment on function public.record_workflow_decision(uuid, text, text) is
  'The only write path for advancing a workflow_instances row (Phase 7.5). Re-verifies the caller matches the CURRENT step''s required_role_code/required_user_id — management.approvals.manage alone is NOT sufficient to decide a step you do not hold, by design (that permission governs Approval Center visibility and administrative override, not step impersonation). Fixed in 0030 to qualify every WHERE-clause `id` reference against this function''s own RETURNS TABLE OUT parameter of the same name — see 0030''s file header.';

grant execute on function public.record_workflow_decision(uuid, text, text) to authenticated;
