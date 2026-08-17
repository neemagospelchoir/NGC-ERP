import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapUniformAssignmentRow } from "./map";
import type { AssignUniformInput, ReturnUniformAssignmentInput, UniformAssignment } from "./types";

/**
 * Issues `quantity` units of a uniform to a member (optionally tied to a
 * specific event — null means a standing/permanent issue, per 0012's own
 * column comment). Unlike Assets (individual, uniquely tagged physical
 * items), a uniform registry entry is a POOLED count — availability is a
 * number, not a status flag — so the check here is `quantity_available >=
 * quantity`, not an equality check against a single "available" state.
 *
 * This is a select-then-check-then-update sequence with no additional
 * locking, the same documented, accepted TOCTOU race as
 * `inventory.assignAsset`'s member/department path (docs/PHASE_8_1.md
 * §2.3): two concurrent assignments could both pass the check before
 * either write commits, temporarily over-issuing stock. Real-world harm
 * is a stock-count discrepancy an admin corrects via `updateUniform`'s
 * manual `quantityAvailable` field, not a privilege or data-integrity
 * boundary — same severity class, not fixed here for the same reason.
 */
export async function assignUniform(client: SupabaseClient<Database>, input: AssignUniformInput): Promise<UniformAssignment> {
  const quantity = input.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity < 1) throw new ServiceError("Quantity must be at least 1.");
  if (!input.memberId) throw new ServiceError("A member is required.");

  const { data: uniformRow, error: uniformError } = await client
    .from("uniforms")
    .select("id, quantity_available, condition")
    .eq("id", input.uniformId)
    .maybeSingle();
  if (uniformError) throw new ServiceError("Could not load the uniform.", uniformError);
  if (!uniformRow) throw new ServiceError("Uniform not found.");

  // `retired` is terminal (update.ts's own doc comment) — never issuable
  // again regardless of what quantityAvailable happens to read.
  if (uniformRow.condition === "retired") {
    throw new ServiceError("This uniform has been retired and can no longer be issued.");
  }
  if (uniformRow.quantity_available < quantity) {
    throw new ServiceError(`Only ${uniformRow.quantity_available} available — cannot issue ${quantity}.`);
  }

  const { data, error } = await client
    .from("uniform_assignments")
    .insert({
      uniform_id: input.uniformId,
      member_id: input.memberId,
      event_id: input.eventId ?? null,
      quantity,
      assigned_by: input.assignedBy ?? null,
      assigned_at: new Date().toISOString(),
      status: "assigned",
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the assignment.", error);

  const { error: uniformUpdateError } = await client
    .from("uniforms")
    .update({ quantity_available: uniformRow.quantity_available - quantity })
    .eq("id", input.uniformId);
  if (uniformUpdateError) {
    throw new ServiceError(
      "The assignment was recorded, but the uniform's available quantity could not be updated. Please contact an administrator.",
      uniformUpdateError
    );
  }

  return mapUniformAssignmentRow(data);
}

/**
 * Records a return. `good` restores the issued quantity to circulation;
 * `damaged` keeps it out of circulation until an admin manually restocks
 * it via `updateUniform` once repaired (there is no repair-tracking
 * workflow in this phase — see docs/PHASE_8_2.md); `lost` permanently
 * reduces `quantityTotal` (clamped at zero), since the item no longer
 * exists to be re-issued or repaired. Not atomic across the two writes
 * (assignment update, uniform update) — same documented, non-silent
 * limitation as every other multi-step write in this codebase.
 */
export async function returnUniformAssignment(
  client: SupabaseClient<Database>,
  input: ReturnUniformAssignmentInput
): Promise<UniformAssignment> {
  const { data: assignmentRow, error: assignmentError } = await client
    .from("uniform_assignments")
    .select("id, uniform_id, quantity, returned_at")
    .eq("id", input.assignmentId)
    .maybeSingle();
  if (assignmentError) throw new ServiceError("Could not load the assignment.", assignmentError);
  if (!assignmentRow) throw new ServiceError("Assignment not found.");
  if (assignmentRow.returned_at) throw new ServiceError("This assignment has already been returned.");

  const status = input.returnCondition === "good" ? "returned" : input.returnCondition === "damaged" ? "damaged" : "lost";

  const { data, error } = await client
    .from("uniform_assignments")
    .update({
      returned_at: input.returnedAt ?? new Date().toISOString(),
      return_condition: input.returnCondition,
      status,
    })
    .eq("id", input.assignmentId)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not record the return.", error);

  if (input.returnCondition === "good" || input.returnCondition === "lost") {
    const { data: uniformRow, error: uniformError } = await client
      .from("uniforms")
      .select("quantity_total, quantity_available, condition")
      .eq("id", assignmentRow.uniform_id)
      .maybeSingle();
    if (uniformError) throw new ServiceError("Could not load the uniform.", uniformError);
    // A `good` return would otherwise unconditionally re-inflate
    // `quantity_available`, even for a uniform that has since been
    // retired (which force-zeroes it as its terminal-state marker — see
    // update.ts's `setUniformCondition`). Units outstanding at the time
    // of retirement can still be returned for record-keeping, but a
    // retired uniform must stay at zero available — `assignUniform`'s own
    // `condition === "retired"` check is what actually blocks re-issuance,
    // but leaving a nonzero count here would contradict the "retired ⇒ 0
    // available" invariant shown throughout the UI (StatusPill + count).
    if (uniformRow && !(input.returnCondition === "good" && uniformRow.condition === "retired")) {
      const patch =
        input.returnCondition === "good"
          ? { quantity_available: uniformRow.quantity_available + assignmentRow.quantity }
          : { quantity_total: Math.max(0, uniformRow.quantity_total - assignmentRow.quantity) };
      const { error: uniformUpdateError } = await client.from("uniforms").update(patch).eq("id", assignmentRow.uniform_id);
      if (uniformUpdateError) {
        throw new ServiceError(
          "The return was recorded, but the uniform's stock counts could not be updated. Please contact an administrator.",
          uniformUpdateError
        );
      }
    }
  }

  return mapUniformAssignmentRow(data);
}
