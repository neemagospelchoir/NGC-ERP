-- ============================================================================
-- 0028_workflow_decision_function.sql
-- Phase 7.5 (Events/Invitations & Approvals). Fixes a real, pre-existing
-- gap in 0019_workflow_engine.sql discovered while wiring the engine up to
-- its first real caller (Invitations).
--
-- THE GAP: the seeded default "Standard Invitation Approval" chain
-- (001_reference_data.sql) is secretary -> technical_manager ->
-- finance_manager -> chairman. But `workflow_instances_write_service`
-- (0019) requires `management.approvals.manage` to UPDATE a
-- workflow_instances row (i.e. to advance current_step_order) — and per
-- the same seed data, `technical_manager` and `finance_manager` hold only
-- `management.approvals.read_all`, never `.manage` (only secretary,
-- chairman/vice_chairman, and super_admin hold `.manage`). As written,
-- the Technical Manager and Finance Manager approval steps could never
-- actually be advanced by the people the PRD names as their approvers —
-- they could see their pending step (the SELECT policy already handles
-- that correctly) but had no RLS-legal way to act on it.
--
-- THE FIX: `record_workflow_decision`, a SECURITY DEFINER RPC — the same
-- "narrow, purpose-built escape hatch" pattern used for Discipline's
-- `apply_disciplinary_membership_status` (0026). It re-verifies, itself,
-- that the caller actually matches the CURRENT step's required_role_code
-- or required_user_id (never trusting `management.approvals.manage` as a
-- stand-in for "is the right approver" — that permission governs
-- Approval-Center *visibility* and administrative override, not step
-- impersonation), inserts the decision row, and advances/resolves the
-- instance. This is the module's ONLY write path for step decisions,
-- exactly as `apply_disciplinary_membership_status` is Discipline's only
-- write path onto `members.membership_status`.
--
-- DEFENSE IN DEPTH: `workflow_step_decisions_insert_approver` (0019) only
-- checked `approver_id = auth.uid()` — satisfiable by any authenticated
-- user for any workflow_instance, regardless of whether they actually
-- hold the current step's role. Tightened below to require the same
-- role/user match the new function enforces, so a direct client-side
-- insert (bypassing the RPC) is blocked at the RLS layer too, not just by
-- convention.
-- ============================================================================

drop policy if exists workflow_step_decisions_insert_approver on public.workflow_step_decisions;
create policy workflow_step_decisions_insert_approver on public.workflow_step_decisions
  for insert with check (
    approver_id = auth.uid()
    and exists (
      select 1
      from public.workflow_instances wi
      join public.workflow_definition_steps s
        on s.workflow_definition_id = wi.workflow_definition_id
        and s.step_order = wi.current_step_order
      where wi.id = workflow_step_decisions.workflow_instance_id
        and wi.status = 'pending'
        and workflow_step_decisions.step_order = wi.current_step_order
        and (s.required_user_id = auth.uid() or public.has_role(coalesce(s.required_role_code, '')))
    )
  );

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

  select * into v_instance from public.workflow_instances where id = p_workflow_instance_id for update;
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
    update public.workflow_instances set status = 'rejected' where id = p_workflow_instance_id;
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
      update public.workflow_instances set status = 'approved' where id = p_workflow_instance_id;
    else
      update public.workflow_instances set current_step_order = v_instance.current_step_order + 1
        where id = p_workflow_instance_id;
    end if;
  end if;

  return query
    select wi.id, wi.status, wi.current_step_order, wi.record_type, wi.record_id
    from public.workflow_instances wi
    where wi.id = p_workflow_instance_id;
end;
$$;

comment on function public.record_workflow_decision(uuid, text, text) is
  'The only write path for advancing a workflow_instances row (Phase 7.5). Re-verifies the caller matches the CURRENT step''s required_role_code/required_user_id — management.approvals.manage alone is NOT sufficient to decide a step you do not hold, by design (that permission governs Approval Center visibility and administrative override, not step impersonation).';

grant execute on function public.record_workflow_decision(uuid, text, text) to authenticated;
