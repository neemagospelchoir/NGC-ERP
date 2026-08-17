import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { asInstanceStatus } from "./map";
import type { WorkflowInstanceStatus, WorkflowInstanceSummary } from "./types";

type WorkflowInstanceRow = Database["public"]["Tables"]["workflow_instances"]["Row"];

/**
 * Shared by `listMyPendingApprovals` and `listWorkflowInstances` (Phase
 * 13.2's Management Report): given a batch of already-RLS-filtered
 * `workflow_instances` rows, resolves each one's `workflow_definitions.
 * name` and current step's role/user, exactly once per unique definition
 * id rather than once per instance. Extracted so the Management Report
 * doesn't reimplement this resolution a second time with its own,
 * possibly-drifting copy.
 */
async function hydrateInstances(
  client: SupabaseClient<Database>,
  instances: WorkflowInstanceRow[]
): Promise<WorkflowInstanceSummary[]> {
  if (instances.length === 0) return [];

  const definitionIds = [...new Set(instances.map((i) => i.workflow_definition_id))];
  const { data: definitions, error: definitionError } = await client
    .from("workflow_definitions")
    .select("id, name")
    .in("id", definitionIds);
  if (definitionError) throw new ServiceError("Could not load workflow definitions.", definitionError);
  const definitionNameById = new Map((definitions ?? []).map((d) => [d.id, d.name]));

  const { data: steps, error: stepsError } = await client
    .from("workflow_definition_steps")
    .select("workflow_definition_id, step_order, required_role_code, required_user_id")
    .in("workflow_definition_id", definitionIds);
  if (stepsError) throw new ServiceError("Could not load workflow steps.", stepsError);
  const stepByDefinitionAndOrder = new Map(
    (steps ?? []).map((s) => [`${s.workflow_definition_id}:${s.step_order}`, s])
  );

  return instances.map((instance) => {
    const step = stepByDefinitionAndOrder.get(`${instance.workflow_definition_id}:${instance.current_step_order}`);
    return {
      id: instance.id,
      workflowDefinitionId: instance.workflow_definition_id,
      definitionName: definitionNameById.get(instance.workflow_definition_id) ?? "Approval workflow",
      recordType: instance.record_type,
      recordId: instance.record_id,
      currentStepOrder: instance.current_step_order,
      currentStepRoleCode: step?.required_role_code ?? null,
      currentStepUserId: step?.required_user_id ?? null,
      status: asInstanceStatus(instance.status),
      createdAt: instance.created_at,
      updatedAt: instance.updated_at,
    };
  });
}

/**
 * The Management Approval Center query (ARCHITECTURE.md §12, PRD §7.29/
 * §9.5): every open `workflow_instances` row the CALLER is allowed to see.
 * No application-layer scoping is applied here — `workflow_instances_
 * select_scoped` (0019) already returns only instances where the caller
 * holds `management.approvals.read_all` OR matches the current step's
 * required role/user, so this is one unfiltered query reused across every
 * approvable record type, exactly as ARCHITECTURE.md §12 describes: "one
 * UI, reused across every approvable record type, rather than a bespoke
 * inbox per module." Today only `record_type = 'invitation'` has a real
 * module behind it (Expenses/Gate Passes/Applications/Procurement are not
 * yet wired to this engine — see docs/PHASE_7_5.md §1); callers should
 * treat any other `record_type` as a forward-compatible placeholder.
 */
export async function listMyPendingApprovals(client: SupabaseClient<Database>): Promise<WorkflowInstanceSummary[]> {
  const { data: instances, error } = await client
    .from("workflow_instances")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new ServiceError("Could not load pending approvals.", error);
  return hydrateInstances(client, instances ?? []);
}

export interface ListWorkflowInstancesOptions {
  status?: WorkflowInstanceStatus;
  /** Inclusive `created_at` range. */
  createdFrom?: string;
  createdTo?: string;
}

/**
 * Every workflow instance within a period, of any status — not just the
 * currently-`pending` ones `listMyPendingApprovals` returns — used by the
 * Management Report (Phase 13.2). Deliberately issues no new RLS: the
 * exact same `workflow_instances_select_scoped` policy (0019) that scopes
 * the Approval Center scopes this too, inherited unchanged. That policy's
 * own shape means this report is, in practice, most useful to a
 * `management.approvals.read_all` holder — a caller who only ever matched
 * one step's role/user will only see instances still sitting at that
 * exact step, an existing RLS characteristic this function does not
 * change (see the policy's own `exists (... s.step_order = workflow_
 * instances.current_step_order ...)` clause: once an instance advances
 * past a step, that step's approver loses visibility into it via this
 * policy, resolved or not).
 */
export async function listWorkflowInstances(
  client: SupabaseClient<Database>,
  options: ListWorkflowInstancesOptions = {}
): Promise<WorkflowInstanceSummary[]> {
  let query = client.from("workflow_instances").select("*").order("created_at", { ascending: false });
  if (options.status) query = query.eq("status", options.status);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);

  const { data: instances, error } = await query;
  if (error) throw new ServiceError("Could not load workflow instances.", error);
  return hydrateInstances(client, instances ?? []);
}
