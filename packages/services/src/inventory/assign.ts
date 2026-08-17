import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAssetAssignmentRow, mapAssetRow } from "./map";
import type { Asset, AssetAssignment, AssignAssetInput, ReturnAssignmentInput } from "./types";

/**
 * Assigns an asset to a member, department, or event (PRD §7.5/§7.6). The
 * hard double-booking backstop for `target_type = 'event'` is the partial
 * unique index `uq_asset_assignments_no_concurrent_event_booking` (0010) —
 * a second concurrent event assignment of the same asset always fails at
 * the database layer, with no override possible, matching the spec's
 * "blocks double-booking absent explicit override" read literally: the
 * override applies to the application-layer availability check below, not
 * to that index.
 *
 * For member/department targets (which the index does not cover), this
 * function checks `availability_status` itself and requires
 * `input.override = true` to proceed if the asset isn't `available` — the
 * "explicit override" PRD §7.6 describes, recorded here as a caller
 * decision rather than a silent bypass. Every successful assignment sets
 * the asset's `availability_status` to `assigned`, since a physical asset
 * cannot simultaneously be in more than one place regardless of which
 * target type it was lent to.
 */
export async function assignAsset(client: SupabaseClient<Database>, input: AssignAssetInput): Promise<AssetAssignment> {
  if (!input.targetId) throw new ServiceError("An assignment target is required.");

  const { data: assetRow, error: assetError } = await client
    .from("assets")
    .select("id, availability_status")
    .eq("id", input.assetId)
    .maybeSingle();
  if (assetError) throw new ServiceError("Could not load the asset.", assetError);
  if (!assetRow) throw new ServiceError("Asset not found.");

  // `disposed` is a terminal state (0010's own comment: disposal is
  // permanent, the row is kept only for history) — unlike every other
  // non-available status, there is no override for it. A disposed asset
  // must be un-disposed (not supported by this phase — see
  // docs/PHASE_8_1.md) before it can ever be assigned again.
  if (assetRow.availability_status === "disposed") {
    throw new ServiceError("This asset has been disposed of and can no longer be assigned.");
  }

  if (assetRow.availability_status !== "available" && !input.override) {
    throw new ServiceError(
      `This asset is currently "${assetRow.availability_status}", not available. Confirm the override to assign it anyway.`
    );
  }

  const { data, error } = await client
    .from("asset_assignments")
    .insert({
      asset_id: input.assetId,
      target_type: input.targetType,
      target_id: input.targetId,
      quantity: input.quantity ?? 1,
      assigned_by: input.assignedBy ?? null,
      assigned_at: new Date().toISOString(),
      expected_return_at: input.expectedReturnAt ?? null,
      status: "assigned",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError("This asset already has an active assignment to this event — it cannot be double-booked.", error);
    }
    throw new ServiceError("Could not create the assignment.", error);
  }

  const { error: assetUpdateError } = await client.from("assets").update({ availability_status: "assigned" }).eq("id", input.assetId);
  if (assetUpdateError) {
    throw new ServiceError(
      "The assignment was recorded, but the asset's availability status could not be updated. Please contact an administrator.",
      assetUpdateError
    );
  }

  return mapAssetAssignmentRow(data);
}

/**
 * Records a return, closing out the assignment and restoring the asset to
 * an appropriate `availability_status`: `good` → `available`, `damaged` →
 * `under_maintenance` (needs attention before it can be lent again),
 * `lost` → `missing`. Not atomic across the two writes (assignment update,
 * asset update) — same documented, non-silent limitation as every other
 * multi-step write in this codebase (`recordAction`, `convertApplicationToMember`, etc.).
 */
export async function returnAssignment(client: SupabaseClient<Database>, input: ReturnAssignmentInput): Promise<AssetAssignment> {
  if (input.returnCondition === "damaged" && !input.damageReport) {
    throw new ServiceError("A damage report is required when returning an asset as damaged.");
  }

  const { data: assignmentRow, error: assignmentError } = await client
    .from("asset_assignments")
    .select("id, asset_id, returned_at")
    .eq("id", input.assignmentId)
    .maybeSingle();
  if (assignmentError) throw new ServiceError("Could not load the assignment.", assignmentError);
  if (!assignmentRow) throw new ServiceError("Assignment not found.");
  if (assignmentRow.returned_at) throw new ServiceError("This assignment has already been returned.");

  const status = input.returnCondition === "good" ? "returned" : input.returnCondition === "damaged" ? "damaged" : "lost";

  const { data, error } = await client
    .from("asset_assignments")
    .update({
      returned_at: input.returnedAt ?? new Date().toISOString(),
      return_condition: input.returnCondition,
      damage_report: input.damageReport ?? null,
      status,
    })
    .eq("id", input.assignmentId)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not record the return.", error);

  const newAvailability = input.returnCondition === "good" ? "available" : input.returnCondition === "damaged" ? "under_maintenance" : "missing";
  const { error: assetUpdateError } = await client
    .from("assets")
    .update({ availability_status: newAvailability })
    .eq("id", assignmentRow.asset_id);
  if (assetUpdateError) {
    throw new ServiceError(
      "The return was recorded, but the asset's availability status could not be updated. Please contact an administrator.",
      assetUpdateError
    );
  }

  return mapAssetAssignmentRow(data);
}

export async function getAssetOrThrow(client: SupabaseClient<Database>, id: string): Promise<Asset> {
  const { data, error } = await client.from("assets").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the asset.", error);
  if (!data) throw new ServiceError("Asset not found.");
  return mapAssetRow(data);
}
