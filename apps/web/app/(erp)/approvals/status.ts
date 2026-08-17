import type { workflow } from "@ngc/services";

/**
 * Added for Phase 13.2's Management Report filter dropdown. The Approval
 * Center itself (`approval-row.tsx`) has no need for a status dropdown —
 * it only ever shows pending instances — so no equivalent existed before
 * this report. Same shape as CASE_STATUS_OPTIONS/LEAVE_STATUS_OPTIONS in
 * the discipline/leave modules.
 */
const WORKFLOW_INSTANCE_STATUS_LABEL: Record<workflow.WorkflowInstanceStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const WORKFLOW_INSTANCE_STATUS_OPTIONS = Object.entries(WORKFLOW_INSTANCE_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
