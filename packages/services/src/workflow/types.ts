export type WorkflowInstanceStatus = "pending" | "approved" | "rejected" | "cancelled";
export type WorkflowDecisionType = "approve" | "reject" | "request_changes";

export interface WorkflowInstanceSummary {
  id: string;
  workflowDefinitionId: string;
  definitionName: string;
  recordType: string;
  recordId: string;
  currentStepOrder: number;
  /** `required_role_code` for the CURRENT step, or `null` if the step instead names a specific user (see `currentStepUserId`) — a display hint only; the actual decision is re-authorized server-side by `record_workflow_decision` (0028). */
  currentStepRoleCode: string | null;
  /** `required_user_id` for the CURRENT step, or `null` if the step instead names a role (see `currentStepRoleCode`). A step names exactly one of the two, never both — see 0019's `workflow_definition_steps` schema. Callers matching "is this my step" must check BOTH fields (a security review of this phase found the Approval Center page checking only `currentStepRoleCode`, which silently hid any user-specific step from its assigned approver — fails closed, but broke the feature for that step shape). */
  currentStepUserId: string | null;
  status: WorkflowInstanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepDecisionSummary {
  id: string;
  workflowInstanceId: string;
  stepOrder: number;
  approverId: string;
  approverRoleCode: string | null;
  decision: WorkflowDecisionType;
  comment: string | null;
  decidedAt: string;
}

export interface StartWorkflowInput {
  recordType: string;
  recordId: string;
  /** Picks a specific named definition (0019's `workflow_definitions.name`, unique per `record_type`) — omit to use whichever active definition for `recordType` was seeded/configured first (there is exactly one per `record_type` today; multiple active definitions per type is a future "choose a chain" feature, not built here). */
  definitionName?: string;
}

export interface RecordWorkflowDecisionInput {
  workflowInstanceId: string;
  decision: WorkflowDecisionType;
  comment?: string | null;
  /** The signed-in user's id and currently-held role codes (from `auth.getCurrentUserWithRoles`) — used for an app-layer pre-check BEFORE calling the database function, so a wrong-approver click fails with a clear message instead of a raw Postgres error. This is a defense-in-depth convenience, not the authorization boundary itself: `record_workflow_decision` (0028) re-verifies the same thing server-side regardless of what is passed here. */
  actingUserId: string;
  actingUserRoleCodes: string[];
}
