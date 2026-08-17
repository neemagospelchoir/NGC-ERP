import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapActionSummary } from "./map";
import type { ActionSummary, RestoreSuspensionInput } from "./types";

/**
 * PRD §9.4's "Restoration (if applicable) requires authorized admin +
 * reason + audit record" and 0007's own table comment: "Restoration...
 * requires restored_by + restoration_reason (spec S28)." A restored
 * suspension is never deleted (spec S71.3) — this only sets the three
 * restoration columns on the existing row.
 *
 * The member is only moved back to `active` if their `membership_status`
 * is currently `suspended` — a defensive check, not a formality: if
 * something else has since moved them to e.g. `exited` (a later
 * dismissal, or an unrelated HR action), restoring THIS suspension must
 * not silently overwrite that newer, unrelated status change.
 */
export async function restoreSuspension(client: SupabaseClient<Database>, input: RestoreSuspensionInput): Promise<ActionSummary> {
  const restorationReason = input.restorationReason.trim();
  if (!restorationReason) {
    throw new ServiceError("A restoration reason is required.");
  }

  const { data: action, error: loadError } = await client
    .from("disciplinary_actions")
    .select("*")
    .eq("id", input.actionId)
    .maybeSingle();
  if (loadError) throw new ServiceError("Could not load the disciplinary action.", loadError);
  if (!action) throw new ServiceError("Disciplinary action not found.");
  if (action.action_type !== "suspension") {
    throw new ServiceError("Only a suspension action can be restored.");
  }
  if (action.restored_at) {
    throw new ServiceError("This suspension has already been restored.");
  }

  const { data: caseRow, error: caseError } = await client
    .from("disciplinary_cases")
    .select("member_id")
    .eq("id", action.case_id)
    .single();
  if (caseError) throw new ServiceError("Could not load the associated case.", caseError);

  const { data: updated, error } = await client
    .from("disciplinary_actions")
    .update({
      restored_by: input.restoredBy,
      restored_at: new Date().toISOString(),
      restoration_reason: restorationReason,
    })
    .eq("id", input.actionId)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not restore the suspension.", error);

  const { data: memberRow, error: memberError } = await client
    .from("members")
    .select("membership_status")
    .eq("id", caseRow.member_id)
    .single();
  if (memberError) throw new ServiceError("Could not re-read the member.", memberError);

  if (memberRow.membership_status === "suspended") {
    const { error: rpcError } = await client.rpc("apply_disciplinary_membership_status", {
      p_member_id: caseRow.member_id,
      p_status: "active",
    });
    if (rpcError) {
      throw new ServiceError(
        "The suspension was restored, but the member's status could not be updated. Please contact an administrator.",
        rpcError
      );
    }
  }

  return mapActionSummary(updated);
}
