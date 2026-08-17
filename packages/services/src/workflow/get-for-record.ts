import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { asInstanceStatus, mapStepDecision } from "./map";
import type { WorkflowInstanceSummary, WorkflowStepDecisionSummary } from "./types";

/** The single workflow instance attached to one record (0019's `unique (record_type, record_id)`), or `null` if that record's approval chain hasn't started yet. */
export async function getWorkflowForRecord(
  client: SupabaseClient<Database>,
  recordType: string,
  recordId: string
): Promise<WorkflowInstanceSummary | null> {
  const { data: instance, error } = await client
    .from("workflow_instances")
    .select("*")
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .maybeSingle();
  if (error) throw new ServiceError("Could not load the approval workflow for this record.", error);
  if (!instance) return null;

  const { data: definition, error: definitionError } = await client
    .from("workflow_definitions")
    .select("name")
    .eq("id", instance.workflow_definition_id)
    .maybeSingle();
  if (definitionError) throw new ServiceError("Could not load the workflow definition.", definitionError);

  const { data: step, error: stepError } = await client
    .from("workflow_definition_steps")
    .select("required_role_code, required_user_id")
    .eq("workflow_definition_id", instance.workflow_definition_id)
    .eq("step_order", instance.current_step_order)
    .maybeSingle();
  if (stepError) throw new ServiceError("Could not load the current workflow step.", stepError);

  return {
    id: instance.id,
    workflowDefinitionId: instance.workflow_definition_id,
    definitionName: definition?.name ?? "Approval workflow",
    recordType: instance.record_type,
    recordId: instance.record_id,
    currentStepOrder: instance.current_step_order,
    currentStepRoleCode: step?.required_role_code ?? null,
    currentStepUserId: step?.required_user_id ?? null,
    status: asInstanceStatus(instance.status),
    createdAt: instance.created_at,
    updatedAt: instance.updated_at,
  };
}

export async function listWorkflowDecisions(
  client: SupabaseClient<Database>,
  workflowInstanceId: string
): Promise<WorkflowStepDecisionSummary[]> {
  const { data, error } = await client
    .from("workflow_step_decisions")
    .select("*")
    .eq("workflow_instance_id", workflowInstanceId)
    .order("decided_at", { ascending: true });
  if (error) throw new ServiceError("Could not load the workflow's decision history.", error);
  return (data ?? []).map(mapStepDecision);
}
