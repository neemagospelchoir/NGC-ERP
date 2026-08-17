-- ============================================================================
-- 0029_gate_pass_workflow_start.sql
-- Phase 8.3 (Gate Pass). Fixes a real, pre-existing gap in
-- 0019_workflow_engine.sql discovered while wiring the engine up to its
-- second real caller (Gate Pass) — a distinct gap from the one
-- 0028_workflow_decision_function.sql fixed for DECIDING a step.
--
-- THE GAP: the seeded "Standard Gate Pass Approval" chain
-- (001_reference_data.sql) is technical_manager -> secretary, matching PRD
-- §7.6 ("...requiring Technical Manager then Secretary approval") and §6's
-- Permission Matrix ("Technical Manager: Create, Approve (tier 1)")
-- exactly. But `workflow_instances_write_service` (0019) requires
-- `management.approvals.manage` to INSERT a workflow_instances row (a FOR
-- ALL policy's USING clause doubles as the implicit WITH CHECK when none is
-- given) — and per the seed, `technical_manager` (who both creates a gate
-- pass, via `inventory.gate_passes.manage`, and is its own tier-1 approver)
-- holds only `management.approvals.read_all`, never `.manage` (only
-- secretary/chairman/vice_chairman/super_admin hold `.manage`).
--
-- This is a different shape from Invitations' equivalent call
-- (packages/services/src/invitations/approval.ts's `startInvitationApproval`,
-- a plain RLS-scoped `startWorkflow()` insert): there, Secretary happens to
-- hold BOTH `events.invitations.manage` (which gates starting the review)
-- AND `management.approvals.manage`, so the plain path already works. For
-- Gate Pass, nobody who would naturally create one holds
-- `management.approvals.manage` — the plain path is unusable by design,
-- not by oversight, once you look at who the PRD names as the creator.
--
-- THE FIX: `start_gate_pass_workflow`, a SECURITY DEFINER RPC — the same
-- "narrow, purpose-built escape hatch" pattern as `record_workflow_decision`
-- (0028) and `apply_disciplinary_membership_status` (0026). It re-verifies,
-- itself, that the caller holds `inventory.gate_passes.manage` (never a
-- client-supplied flag), that the gate pass exists, is still
-- `pending_approval`, has at least one line item, and has no existing
-- workflow instance — then creates the instance against the seeded
-- "Standard Gate Pass Approval" definition. This is the ONLY path
-- packages/services/src/gate-passes' `submitGatePassForApproval` uses to
-- start the chain; deciding each step afterwards still goes through the
-- existing, generic, already-correct `record_workflow_decision` (0028),
-- which needs no change — its gap was about impersonating an approver, not
-- about who may create the instance, and it already re-verifies the
-- decider's own role/user match regardless of caller.
-- ============================================================================

create or replace function public.start_gate_pass_workflow(
  p_gate_pass_id uuid
) returns table (
  id uuid,
  workflow_definition_id uuid,
  record_type text,
  record_id uuid,
  current_step_order int,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate_pass record;
  v_definition record;
  v_existing_instance record;
  v_item_count int;
  v_instance_id uuid;
begin
  if not public.has_permission('inventory.gate_passes.manage') then
    raise exception 'You do not have permission to submit gate passes for approval' using errcode = '42501';
  end if;

  -- Every bare column reference below is qualified with a table alias
  -- (`gp.id`, not `id`) even in single-table queries — this function's own
  -- RETURNS TABLE clause declares OUT parameters named `id`, `record_type`,
  -- `record_id`, `status`, and `created_at`, which plpgsql's default
  -- `variable_conflict = error` setting treats as ambiguous against a
  -- same-named column unless the column is explicitly qualified. See this
  -- migration's own file header and 0030_record_workflow_decision_column_
  -- qualification_fix.sql for the identical, pre-existing bug this
  -- discovered in 0028's `record_workflow_decision` — untested against a
  -- real Postgres instance until this phase, since neither the e2e mock
  -- server nor the unit-test fake client model plpgsql variable/column
  -- resolution.
  select * into v_gate_pass from public.gate_passes gp where gp.id = p_gate_pass_id for update;
  if v_gate_pass is null then
    raise exception 'Gate pass not found' using errcode = '22023';
  end if;
  if v_gate_pass.status <> 'pending_approval' then
    raise exception 'This gate pass is no longer awaiting submission' using errcode = '22023';
  end if;

  select count(*) into v_item_count from public.gate_pass_items gpi where gpi.gate_pass_id = p_gate_pass_id;
  if v_item_count = 0 then
    raise exception 'Add at least one item before submitting a gate pass for approval' using errcode = '22023';
  end if;

  select * into v_existing_instance from public.workflow_instances wi
    where wi.record_type = 'gate_pass' and wi.record_id = p_gate_pass_id;
  if v_existing_instance is not null then
    raise exception 'An approval workflow has already been started for this gate pass' using errcode = '22023';
  end if;

  select * into v_definition from public.workflow_definitions wd
    where wd.record_type = 'gate_pass' and wd.is_active = true
    order by wd.created_at asc limit 1;
  if v_definition is null then
    raise exception 'No active approval workflow is configured for gate passes' using errcode = '22023';
  end if;

  insert into public.workflow_instances (workflow_definition_id, record_type, record_id, current_step_order, status)
  values (v_definition.id, 'gate_pass', p_gate_pass_id, 1, 'pending')
  returning workflow_instances.id into v_instance_id;

  return query
    select wi.id, wi.workflow_definition_id, wi.record_type, wi.record_id, wi.current_step_order, wi.status, wi.created_at, wi.updated_at
    from public.workflow_instances wi
    where wi.id = v_instance_id;
end;
$$;

comment on function public.start_gate_pass_workflow(uuid) is
  'The only path that starts a gate pass''s approval workflow (Phase 8.3). Re-verifies inventory.gate_passes.manage itself rather than trusting workflow_instances_write_service''s management.approvals.manage gate, which the people who actually create gate passes (Technical Manager, Inventory Officer) do not hold — see this migration''s file header.';

grant execute on function public.start_gate_pass_workflow(uuid) to authenticated;
