import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { asInstanceStatus } from "./map";
import type { RecordWorkflowDecisionInput, WorkflowInstanceStatus } from "./types";

export interface RecordWorkflowDecisionResult {
  workflowInstanceId: string;
  status: WorkflowInstanceStatus;
  currentStepOrder: number;
  recordType: string;
  recordId: string;
}

/**
 * Records one approver's decision on the CURRENT step of a workflow
 * instance and advances/resolves it. The actual write goes through the
 * `record_workflow_decision` SECURITY DEFINER RPC (0028) — see that
 * migration's file header for why a normal RLS-scoped UPDATE on
 * `workflow_instances` cannot do this (Technical Manager/Finance Manager
 * hold no `management.approvals.manage`, only the roles the default
 * Invitations chain actually names them for).
 *
 * Before calling the RPC, re-checks the SAME "are you the current step's
 * approver" condition at the application layer, using the already-loaded
 * instance/step rows and the caller's own role codes — purely so a
 * wrong-approver click surfaces this module's own clear ServiceError
 * instead of a raw `42501` from Postgres. This is belt-and-suspenders,
 * not the authorization boundary: the RPC re-verifies unconditionally
 * regardless of what this pre-check decided.
 */
export async function recordWorkflowDecision(
  client: SupabaseClient<Database>,
  input: RecordWorkflowDecisionInput
): Promise<RecordWorkflowDecisionResult> {
  if (input.decision === "request_changes" && !input.comment?.trim()) {
    throw new ServiceError("A comment is required when requesting changes.");
  }

  const { data: instance, error: instanceError } = await client
    .from("workflow_instances")
    .select("*")
    .eq("id", input.workflowInstanceId)
    .maybeSingle();
  if (instanceError) throw new ServiceError("Could not load the approval workflow.", instanceError);
  if (!instance) throw new ServiceError("Approval workflow not found.");
  if (instance.status !== "pending") {
    throw new ServiceError("This approval workflow is no longer awaiting a decision.");
  }

  const { data: step, error: stepError } = await client
    .from("workflow_definition_steps")
    .select("required_role_code, required_user_id")
    .eq("workflow_definition_id", instance.workflow_definition_id)
    .eq("step_order", instance.current_step_order)
    .maybeSingle();
  if (stepError) throw new ServiceError("Could not load the current workflow step.", stepError);
  if (!step) throw new ServiceError("The current workflow step is not configured.");

  const isMatchedUser = step.required_user_id != null && step.required_user_id === input.actingUserId;
  const isMatchedRole = step.required_role_code != null && input.actingUserRoleCodes.includes(step.required_role_code);
  if (!isMatchedUser && !isMatchedRole) {
    throw new ServiceError("You are not the required approver for the current step of this approval.");
  }

  const { data, error } = await client.rpc("record_workflow_decision", {
    p_workflow_instance_id: input.workflowInstanceId,
    p_decision: input.decision,
    p_comment: input.comment ?? null,
  });
  if (error) throw new ServiceError("Could not record the approval decision.", error);

  const result = data?.[0];
  if (!result) throw new ServiceError("The approval decision was not recorded.");

  return {
    workflowInstanceId: result.id,
    status: asInstanceStatus(result.status),
    currentStepOrder: result.current_step_order,
    recordType: result.record_type,
    recordId: result.record_id,
  };
}
