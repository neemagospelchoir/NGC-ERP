import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { getWorkflowForRecord, recordWorkflowDecision } from "../workflow";
import type { WorkflowDecisionType } from "../workflow/types";
import { mapGatePassRow } from "./map";
import type { GatePass } from "./types";

const RECORD_TYPE = "gate_pass";

/**
 * Submits a gate pass into its configured approval chain (seeded "Standard
 * Gate Pass Approval": technical_manager -> secretary, PRD §7.6). Goes
 * through the `start_gate_pass_workflow` SECURITY DEFINER RPC (0029), NOT
 * the generic `workflow.startWorkflow()` — that function's plain RLS-scoped
 * insert requires `management.approvals.manage`, which nobody who actually
 * creates a gate pass (Technical Manager, Inventory Officer — both hold
 * only `inventory.gate_passes.manage`) holds. See 0029's file header for
 * the full reasoning and how this differs from Invitations' equivalent
 * call, where Secretary happens to hold both permissions already.
 */
export async function submitGatePassForApproval(client: SupabaseClient<Database>, gatePassId: string): Promise<void> {
  const { error } = await client.rpc("start_gate_pass_workflow", { p_gate_pass_id: gatePassId });
  if (error) throw new ServiceError(error.message || "Could not submit the gate pass for approval.", error);
}

export interface DecideGatePassApprovalInput {
  gatePassId: string;
  decision: WorkflowDecisionType;
  comment?: string | null;
  actingUserId: string;
  actingUserRoleCodes: string[];
}

export interface DecideGatePassApprovalResult {
  gatePass: GatePass;
  workflowStatus: "pending" | "approved" | "rejected" | "cancelled";
}

/**
 * Records one approver's decision on a gate pass's current approval step
 * (technical_manager then secretary), then reacts to the outcome — fully
 * `approved` moves the gate pass to `approved` (unlocking checkout);
 * `rejected` moves it to `rejected` (terminal — no checkout is ever
 * possible from there, mirroring Assets' disposed-is-terminal precedent,
 * docs/PHASE_8_1.md §2.2); an intermediate `approve` (not yet the last
 * step) or a `request_changes` leaves the gate pass's own `status` column
 * untouched at `pending_approval` — the workflow instance alone tracks
 * where in the chain it is, same division of responsibility as Invitations
 * (docs/PHASE_7_5.md §2.3).
 */
export async function decideGatePassApproval(
  client: SupabaseClient<Database>,
  input: DecideGatePassApprovalInput
): Promise<DecideGatePassApprovalResult> {
  const instance = await getWorkflowForRecord(client, RECORD_TYPE, input.gatePassId);
  if (!instance) throw new ServiceError("This gate pass has no approval workflow to decide.");

  const decisionResult = await recordWorkflowDecision(client, {
    workflowInstanceId: instance.id,
    decision: input.decision,
    comment: input.comment,
    actingUserId: input.actingUserId,
    actingUserRoleCodes: input.actingUserRoleCodes,
  });

  const { data: currentRow, error: currentError } = await client
    .from("gate_passes")
    .select("*")
    .eq("id", input.gatePassId)
    .maybeSingle();
  if (currentError || !currentRow) throw new ServiceError("Could not reload the gate pass.", currentError ?? undefined);
  let gatePass = mapGatePassRow(currentRow);

  if (decisionResult.status === "approved" || decisionResult.status === "rejected") {
    const nextStatus = decisionResult.status === "approved" ? "approved" : "rejected";
    const { data, error } = await client.from("gate_passes").update({ status: nextStatus }).eq("id", input.gatePassId).select("*").single();
    if (error) {
      throw new ServiceError(
        `The gate pass's approval workflow was ${nextStatus}, but its status could not be updated. Please contact an administrator.`,
        error
      );
    }
    gatePass = mapGatePassRow(data);
  }

  return { gatePass, workflowStatus: decisionResult.status };
}
