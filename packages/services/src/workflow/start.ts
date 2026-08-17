import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { asInstanceStatus } from "./map";
import type { StartWorkflowInput, WorkflowInstanceSummary } from "./types";

/**
 * Instantiates a `workflow_instances` row for a record that has just
 * become ready for its configured approval chain (ARCHITECTURE.md §12).
 * A normal RLS-scoped insert — `workflow_instances_write_service` (0019)
 * requires `management.approvals.manage`, which is exactly who this
 * codebase expects to move a record INTO the approval stage (Secretary/
 * Chairman/Super Admin for Invitations' default chain) — unlike
 * record-decision.ts, which must go through the `record_workflow_decision`
 * RPC (0028) because intermediate-step approvers (Technical Manager,
 * Finance Manager) do NOT hold `management.approvals.manage`.
 */
export async function startWorkflow(client: SupabaseClient<Database>, input: StartWorkflowInput): Promise<WorkflowInstanceSummary> {
  let definitionQuery = client
    .from("workflow_definitions")
    .select("*")
    .eq("record_type", input.recordType)
    .eq("is_active", true);
  if (input.definitionName) definitionQuery = definitionQuery.eq("name", input.definitionName);

  const { data: definitions, error: definitionError } = await definitionQuery.order("created_at", { ascending: true }).limit(1);
  if (definitionError) throw new ServiceError("Could not resolve an approval workflow definition.", definitionError);
  const definition = definitions?.[0];
  if (!definition) {
    throw new ServiceError(`No active approval workflow is configured for "${input.recordType}".`);
  }

  // Explicit pre-check rather than relying on catching the unique
  // constraint (record_type, record_id) violation after the fact — gives
  // a clearer error and doesn't depend on the calling client surfacing a
  // Postgres error code faithfully (the unit-test fixture doesn't model
  // composite unique constraints).
  const { data: existing, error: existingError } = await client
    .from("workflow_instances")
    .select("id")
    .eq("record_type", input.recordType)
    .eq("record_id", input.recordId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check for an existing approval workflow.", existingError);
  if (existing) {
    throw new ServiceError("An approval workflow has already been started for this record.");
  }

  const { data, error } = await client
    .from("workflow_instances")
    .insert({
      workflow_definition_id: definition.id,
      record_type: input.recordType,
      record_id: input.recordId,
      current_step_order: 1,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError("An approval workflow has already been started for this record.", error);
    }
    throw new ServiceError("Could not start the approval workflow.", error);
  }

  const { data: firstStep, error: stepError } = await client
    .from("workflow_definition_steps")
    .select("required_role_code, required_user_id")
    .eq("workflow_definition_id", definition.id)
    .eq("step_order", 1)
    .maybeSingle();
  if (stepError) throw new ServiceError("Could not load the workflow's first step.", stepError);

  return {
    id: data.id,
    workflowDefinitionId: data.workflow_definition_id,
    definitionName: definition.name,
    recordType: data.record_type,
    recordId: data.record_id,
    currentStepOrder: data.current_step_order,
    currentStepRoleCode: firstStep?.required_role_code ?? null,
    currentStepUserId: firstStep?.required_user_id ?? null,
    status: asInstanceStatus(data.status),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
