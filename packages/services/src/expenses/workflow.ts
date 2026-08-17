import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { getWorkflowForRecord, recordWorkflowDecision } from "../workflow";
import type { WorkflowDecisionType } from "../workflow/types";
import { mapExpenseRequestRow } from "./map";
import type { ExpenseRequest } from "./types";

const RECORD_TYPE = "expense_request";

/**
 * Submits a draft expense request into its configured approval chain
 * (seeded "Standard Expense Approval": finance_manager -> secretary ->
 * chairman, PRD §7.16/§6). Goes through the `start_expense_request_workflow`
 * SECURITY DEFINER RPC (0031), NOT the generic `workflow.startWorkflow()` —
 * that function's plain RLS-scoped insert requires `management.approvals.
 * manage`, which the actual requester (any member, per `expense_requests_
 * insert_self`) does not hold. See 0031's file header for the full
 * reasoning and how this differs from `start_gate_pass_workflow` (0029):
 * this RPC ALSO flips `expense_requests.status` from `'draft'` to
 * `'pending_approval'` itself, atomically, because — unlike gate passes,
 * which are created already `pending_approval` — an expense request has a
 * genuine, separate draft state to leave.
 *
 * PRD §7.16 describes the lifecycle as "Draft -> Submitted -> Pending
 * Approval -> Approved/Rejected -> Paid -> Closed". This function
 * deliberately treats "Submitted" and "Pending Approval" as ONE transition,
 * not two — nothing in the PRD's text describes a distinct action or
 * behavior that happens only at "Submitted" before "Pending Approval"
 * follows it (unlike, say, Invitations' own internal-review step, which IS
 * a distinct, separately-actionable stage). `expense_requests.status`'s
 * check constraint (0014) still allows `'submitted'` as a value for forward
 * compatibility, but this function — the only path that ever moves a
 * request out of `'draft'` — never sets it.
 */
export async function submitExpenseRequestForApproval(client: SupabaseClient<Database>, expenseRequestId: string): Promise<void> {
  const { error } = await client.rpc("start_expense_request_workflow", { p_expense_request_id: expenseRequestId });
  if (error) throw new ServiceError(error.message || "Could not submit the expense request for approval.", error);
}

export interface DecideExpenseRequestApprovalInput {
  expenseRequestId: string;
  decision: WorkflowDecisionType;
  comment?: string | null;
  actingUserId: string;
  actingUserRoleCodes: string[];
}

export interface DecideExpenseRequestApprovalResult {
  expenseRequest: ExpenseRequest;
  workflowStatus: "pending" | "approved" | "rejected" | "cancelled";
}

/**
 * Records one approver's decision on an expense request's current approval
 * step (finance_manager -> secretary -> chairman, order matching the seed's
 * `workflow_definition_steps` rows), then reacts to the outcome — mirrors
 * `gate-passes/workflow.ts`'s `decideGatePassApproval` exactly: fully
 * `approved` moves the request to `'approved'` (unlocking `markExpensePaid`,
 * lifecycle.ts); `rejected` moves it to `'rejected'` (terminal — no payment
 * is ever possible from there); an intermediate `approve` (not yet the last
 * step) or a `request_changes` leaves `expense_requests.status` untouched
 * at `'pending_approval'` — the workflow instance alone tracks where in the
 * chain it is.
 */
export async function decideExpenseRequestApproval(
  client: SupabaseClient<Database>,
  input: DecideExpenseRequestApprovalInput
): Promise<DecideExpenseRequestApprovalResult> {
  const instance = await getWorkflowForRecord(client, RECORD_TYPE, input.expenseRequestId);
  if (!instance) throw new ServiceError("This expense request has no approval workflow to decide.");

  const decisionResult = await recordWorkflowDecision(client, {
    workflowInstanceId: instance.id,
    decision: input.decision,
    comment: input.comment,
    actingUserId: input.actingUserId,
    actingUserRoleCodes: input.actingUserRoleCodes,
  });

  const { data: currentRow, error: currentError } = await client
    .from("expense_requests")
    .select("*")
    .eq("id", input.expenseRequestId)
    .maybeSingle();
  if (currentError || !currentRow) throw new ServiceError("Could not reload the expense request.", currentError ?? undefined);
  let expenseRequest = mapExpenseRequestRow(currentRow);

  if (decisionResult.status === "approved" || decisionResult.status === "rejected") {
    const nextStatus = decisionResult.status === "approved" ? "approved" : "rejected";
    const { data, error } = await client
      .from("expense_requests")
      .update({ status: nextStatus })
      .eq("id", input.expenseRequestId)
      .select("*")
      .single();
    if (error) {
      throw new ServiceError(
        `The expense request's approval workflow was ${nextStatus}, but its status could not be updated. Please contact an administrator.`,
        error
      );
    }
    expenseRequest = mapExpenseRequestRow(data);
  }

  return { expenseRequest, workflowStatus: decisionResult.status };
}
