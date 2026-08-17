import type { Database } from "@ngc/db";
import type { WorkflowDecisionType, WorkflowInstanceStatus, WorkflowStepDecisionSummary } from "./types";

type WorkflowStepDecisionRow = Database["public"]["Tables"]["workflow_step_decisions"]["Row"];

export function mapStepDecision(row: WorkflowStepDecisionRow): WorkflowStepDecisionSummary {
  return {
    id: row.id,
    workflowInstanceId: row.workflow_instance_id,
    stepOrder: row.step_order,
    approverId: row.approver_id,
    approverRoleCode: row.approver_role_code,
    decision: row.decision as WorkflowDecisionType,
    comment: row.comment,
    decidedAt: row.decided_at,
  };
}

export function asInstanceStatus(value: string): WorkflowInstanceStatus {
  return value as WorkflowInstanceStatus;
}
