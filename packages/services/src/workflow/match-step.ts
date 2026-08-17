import type { WorkflowInstanceSummary } from "./types";

/**
 * "Is the current step of this instance mine?" — a single shared
 * implementation for every caller that needs this check (the Approval
 * Center page's row-level decision-form gate, and its own belt-and-
 * suspenders re-filter of `listMyPendingApprovals()` — see docs/
 * PHASE_7_5.md §5 for why the app layer re-checks this at all). A step
 * names EITHER a `required_role_code` OR a `required_user_id`, never
 * both (0019's `workflow_definition_steps` schema) — a security review of
 * this phase found two call sites checking only the role-code half,
 * which silently hid any user-specific step from its assigned approver
 * (fails closed, but breaks the feature for that step shape). Centralized
 * here so that mistake can't recur independently in a third call site.
 */
export function isCurrentStepFor(instance: WorkflowInstanceSummary, user: { id: string; roleCodes: string[] }): boolean {
  if (instance.currentStepUserId) return instance.currentStepUserId === user.id;
  if (instance.currentStepRoleCode) return user.roleCodes.includes(instance.currentStepRoleCode);
  return false;
}
