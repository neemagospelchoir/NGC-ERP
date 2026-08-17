import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapActionSummary } from "./map";
import type { ActionSummary, RecordActionInput } from "./types";

/**
 * Records a disciplinary action (PRD §9.4: "Action decided (warning/
 * suspension/other) → Resolution recorded"). Two side effects beyond the
 * insert, both intentional and documented here rather than left implicit:
 *
 * 1. `suspension`/`dismissal` call `apply_disciplinary_membership_status`
 *    (0026) to set the member's `membership_status` to `suspended`/
 *    `exited` — the ONLY path this codebase has for a Discipline-driven
 *    status change, since the Discipline Manager role holds no direct
 *    write grant on `members` (see 0026's file header). `warning`,
 *    `probation_extension`, and `other` have no membership_status effect:
 *    `probation_extension` is recorded here as a fact but does NOT extend
 *    the actual `probation` module's deadline — that cross-module wiring
 *    is deferred (flagged in docs/PHASE_7_4.md), consistent with this
 *    codebase's practice of flagging an interpretive gap rather than
 *    silently guessing at an integration the PRD doesn't fully specify.
 *
 * 2. The case's own `status` is bumped to `action_decided` if it's
 *    currently `open` or `under_investigation` — PRD §9.4's flow chart has
 *    no separate manual "mark action decided" step; recording the first
 *    action on a case IS that step.
 *
 * Not atomic across the 2-3 writes involved (insert, member-status RPC,
 * case-status update) — same documented, non-silent limitation as every
 * other multi-step write in this codebase (assignDepartment(),
 * convertApplicationToMember(), etc.); a partial failure is surfaced as a
 * distinct error rather than silently swallowed.
 *
 * Security-review follow-up: refuses a second `suspension` while an
 * earlier one on this same case is still active (unrestored), and refuses
 * a second `dismissal` on a case that already recorded one. Neither would
 * have corrupted `membership_status` (`apply_disciplinary_membership_
 * status` is idempotent), but both would leave confusing duplicate action
 * rows and — for suspension specifically — two "active" suspensions that
 * `restoreSuspension()` would have to reconcile one at a time. Re-
 * suspending AFTER a prior suspension on this case was already restored
 * is still allowed (a member can be suspended again later for the same
 * case if warranted); only an already-open suspension is blocked.
 */
export async function recordAction(client: SupabaseClient<Database>, input: RecordActionInput): Promise<ActionSummary> {
  if (input.actionType === "suspension" && !input.suspensionStartDate) {
    throw new ServiceError("A suspension requires a start date.");
  }

  const { data: caseRow, error: caseError } = await client
    .from("disciplinary_cases")
    .select("id, member_id, status, case_number")
    .eq("id", input.caseId)
    .maybeSingle();
  if (caseError) throw new ServiceError("Could not load the disciplinary case.", caseError);
  if (!caseRow) throw new ServiceError("Disciplinary case not found.");

  if (input.actionType === "suspension" || input.actionType === "dismissal") {
    const { data: existingActions, error: existingError } = await client
      .from("disciplinary_actions")
      .select("action_type, restored_at")
      .eq("case_id", input.caseId);
    if (existingError) throw new ServiceError("Could not check existing actions on this case.", existingError);

    const hasActiveSuspension = (existingActions ?? []).some((a) => a.action_type === "suspension" && !a.restored_at);
    if (input.actionType === "suspension" && hasActiveSuspension) {
      throw new ServiceError("This case already has an active (unrestored) suspension.");
    }
    const hasDismissal = (existingActions ?? []).some((a) => a.action_type === "dismissal");
    if (input.actionType === "dismissal" && hasDismissal) {
      throw new ServiceError("This case has already recorded a dismissal.");
    }
  }

  const { data, error } = await client
    .from("disciplinary_actions")
    .insert({
      case_id: input.caseId,
      action_type: input.actionType,
      decided_by: input.decidedBy,
      suspension_start_date: input.suspensionStartDate ?? null,
      suspension_end_date: input.suspensionEndDate ?? null,
      resolution: input.resolution ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not record the disciplinary action.", error);

  if (input.actionType === "suspension") {
    const { error: rpcError } = await client.rpc("apply_disciplinary_membership_status", {
      p_member_id: caseRow.member_id,
      p_status: "suspended",
    });
    if (rpcError) {
      throw new ServiceError(
        "The suspension was recorded, but the member's status could not be updated. Please contact an administrator.",
        rpcError
      );
    }
  } else if (input.actionType === "dismissal") {
    const { error: rpcError } = await client.rpc("apply_disciplinary_membership_status", {
      p_member_id: caseRow.member_id,
      p_status: "exited",
      p_exit_reason: `Dismissed via disciplinary case ${caseRow.case_number}.`,
    });
    if (rpcError) {
      throw new ServiceError(
        "The dismissal was recorded, but the member's status could not be updated. Please contact an administrator.",
        rpcError
      );
    }
  }

  if (caseRow.status === "open" || caseRow.status === "under_investigation") {
    const { error: statusError } = await client
      .from("disciplinary_cases")
      .update({ status: "action_decided" })
      .eq("id", input.caseId);
    if (statusError) {
      throw new ServiceError("The action was recorded, but the case status could not be updated.", statusError);
    }
  }

  return mapActionSummary(data);
}
