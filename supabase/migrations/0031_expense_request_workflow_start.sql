-- ============================================================================
-- 0031_expense_request_workflow_start.sql
-- Phase 9.2 (Expenses/Petty Cash). Fixes the same shape of gap in
-- 0019_workflow_engine.sql already solved twice — `apply_disciplinary_
-- membership_status`/the Discipline decision path (0026) and
-- `start_gate_pass_workflow` (0029) — extended a third time here.
--
-- THE GAP: `expense_requests_insert_self` RLS (0014) lets ANY member submit
-- their OWN expense request (`requested_by = auth.uid()`), matching PRD
-- §7.16/§6 ("Choir Member: Create (own), Read (own)"; "Dept Leader: Create,
-- Read (own)"). But `workflow_instances_write_service` (0019) requires
-- `management.approvals.manage` to INSERT a `workflow_instances` row — and
-- per the seed, an ordinary member/department leader holds no such
-- permission (only Secretary/Chairman/Vice Chairman/Finance Manager/Super
-- Admin do). The plain `startWorkflow()` path every other self-service
-- submission flow could use is unusable here, structurally, for the exact
-- same reason it was unusable for Gate Pass: whoever the PRD says creates
-- the record is never who the workflow engine's own write policy expects to
-- start its approval chain.
--
-- THE FIX: `start_expense_request_workflow`, the same "narrow, purpose-built
-- escape hatch" SECURITY DEFINER pattern as 0026/0028/0029. Two differences
-- from `start_gate_pass_workflow` (0029), both deliberate:
--
--   1. Its authorization check is `requested_by = auth.uid()` (self-only —
--      whoever created the expense request may submit THAT SPECIFIC
--      request), not a `has_permission(...)` check. Gate Pass's RPC checks
--      `inventory.gate_passes.manage` because gate passes are themselves a
--      permission-gated management record; expense requests are a genuine
--      self-service record any member may create and submit, matching
--      `expense_requests_insert_self`'s own shape exactly.
--
--   2. It ALSO performs the `expense_requests.status = 'draft' ->
--      'pending_approval'` transition itself, atomically, in the same
--      transaction — `gate_passes` has no separate 'draft' state (a gate
--      pass is created already `pending_approval`, 0014's own check
--      constraint has no 'draft' value for that table), but
--      `expense_requests.status` (0014) explicitly does, and PRD §7.16
--      describes "Draft -> Submitted -> Pending Approval" as a real,
--      distinct state a request sits in before submission. This function is
--      the only path that performs that transition; there is no separate
--      "submit" step that only flips the column without also starting the
--      chain (see packages/services/src/expenses' own doc comment on why
--      "Submitted" is never persisted as its own distinct status value —
--      a deliberate simplification, not an oversight).
--
-- Every bare column reference below is qualified with a table alias (`er.id`,
-- not `id`), from the very first draft of this migration — 0029/0030's own
-- discovery (plpgsql's `variable_conflict = error` treats an unqualified
-- column reference sharing a name with this function's own RETURNS TABLE OUT
-- parameters as ambiguous) is applied here pre-emptively rather than
-- rediscovered a third time. This was additionally verified directly against
-- a real local Postgres instance (not just read for style) before being
-- considered validated — see docs/PHASE_9_2.md §4/§6.
-- ============================================================================

create or replace function public.start_expense_request_workflow(
  p_expense_request_id uuid
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
  v_expense_request record;
  v_definition record;
  v_existing_instance record;
  v_instance_id uuid;
begin
  select * into v_expense_request from public.expense_requests er where er.id = p_expense_request_id for update;
  if v_expense_request is null then
    raise exception 'Expense request not found' using errcode = '22023';
  end if;

  -- `is distinct from`, not `<>` — an adversarial security review of this
  -- phase found that plain `<>` evaluates to NULL (neither true nor false)
  -- whenever `auth.uid()` is itself NULL, and plpgsql's `if` treats a NULL
  -- condition as false — silently SKIPPING this authorization check rather
  -- than failing it, for any caller whose session somehow resolves no
  -- current user. `is distinct from` treats NULL as a real, comparable
  -- value (NULL is distinct from any non-null uuid), so a null `auth.uid()`
  -- now correctly raises instead of passing. Verified directly against a
  -- live local Postgres instance: before this fix, calling this function
  -- with `app.current_user_id` unset let the RPC succeed and start the
  -- workflow for someone else's draft; after, it raises immediately.
  if v_expense_request.requested_by is distinct from auth.uid() then
    raise exception 'You may only submit your own expense requests for approval' using errcode = '42501';
  end if;

  if v_expense_request.status <> 'draft' then
    raise exception 'This expense request is no longer a draft' using errcode = '22023';
  end if;

  select * into v_existing_instance from public.workflow_instances wi
    where wi.record_type = 'expense_request' and wi.record_id = p_expense_request_id;
  if v_existing_instance is not null then
    raise exception 'An approval workflow has already been started for this expense request' using errcode = '22023';
  end if;

  select * into v_definition from public.workflow_definitions wd
    where wd.record_type = 'expense_request' and wd.is_active = true
    order by wd.created_at asc limit 1;
  if v_definition is null then
    raise exception 'No active approval workflow is configured for expense requests' using errcode = '22023';
  end if;

  update public.expense_requests set status = 'pending_approval' where expense_requests.id = p_expense_request_id;

  insert into public.workflow_instances (workflow_definition_id, record_type, record_id, current_step_order, status)
  values (v_definition.id, 'expense_request', p_expense_request_id, 1, 'pending')
  returning workflow_instances.id into v_instance_id;

  return query
    select wi.id, wi.workflow_definition_id, wi.record_type, wi.record_id, wi.current_step_order, wi.status, wi.created_at, wi.updated_at
    from public.workflow_instances wi
    where wi.id = v_instance_id;
end;
$$;

comment on function public.start_expense_request_workflow(uuid) is
  'The only path that submits a draft expense request for approval (Phase 9.2) — atomically flips expense_requests.status draft -> pending_approval and starts its workflow_instances chain in one transaction. Authorization is requested_by = auth.uid() (self-submission of one''s own request), not a has_permission(...) check, matching expense_requests_insert_self RLS''s self-service shape exactly (unlike start_gate_pass_workflow''s inventory.gate_passes.manage check, which guards a permission-gated management record instead).';

grant execute on function public.start_expense_request_workflow(uuid) to authenticated;
