import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listAssignmentsForTarget, returnAssignment } from "../inventory";
import { ServiceError } from "../shared/errors";
import { mapGatePassItemRow, mapGatePassRow } from "./map";
import type { GatePass, ReturnGatePassItemInput } from "./types";

/**
 * Checks a gate pass out — PRD §7.6's `Approved -> Checked Out` step.
 * Stamps `checked_out_at` on every item that hasn't already been stamped
 * (there is no partial-checkout modeling in this phase, matching Assets'
 * own "no partial returns" deferral, docs/PHASE_8_1.md §1) and moves the
 * gate pass itself to `checked_out`. The underlying assets already show
 * `availability_status: 'assigned'` from the moment each item was added
 * (add-item.ts) — checkout is a gate-pass-level/paperwork event (the
 * manifest physically left the building), not a separate inventory-side
 * state change.
 */
export async function checkOutGatePass(client: SupabaseClient<Database>, gatePassId: string): Promise<GatePass> {
  const { data: gatePassRow, error: gatePassError } = await client.from("gate_passes").select("*").eq("id", gatePassId).maybeSingle();
  if (gatePassError) throw new ServiceError("Could not load the gate pass.", gatePassError);
  if (!gatePassRow) throw new ServiceError("Gate pass not found.");
  if (gatePassRow.status !== "approved") {
    throw new ServiceError('A gate pass must be "approved" before it can be checked out.');
  }

  const { error: itemsError } = await client
    .from("gate_pass_items")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("gate_pass_id", gatePassId)
    .is("checked_out_at", null);
  if (itemsError) throw new ServiceError("Could not stamp the gate pass items as checked out.", itemsError);

  const { data, error } = await client.from("gate_passes").update({ status: "checked_out" }).eq("id", gatePassId).select("*").single();
  if (error) throw new ServiceError("Could not update the gate pass's status.", error);
  return mapGatePassRow(data);
}

/**
 * Moves a checked-out gate pass to `in_transit` (PRD §7.6's status
 * lifecycle names this as its own state, distinct from `checked_out`) — a
 * plain status transition with no additional side effects; there is no
 * dedicated timestamp column for it in 0011's schema, only the `status`
 * column + the generic `updated_at` trigger, matching how Uniforms tracks
 * condition changes (docs/PHASE_8_2.md).
 */
export async function markGatePassInTransit(client: SupabaseClient<Database>, gatePassId: string): Promise<GatePass> {
  const { data: gatePassRow, error: gatePassError } = await client.from("gate_passes").select("status").eq("id", gatePassId).maybeSingle();
  if (gatePassError) throw new ServiceError("Could not load the gate pass.", gatePassError);
  if (!gatePassRow) throw new ServiceError("Gate pass not found.");
  if (gatePassRow.status !== "checked_out") {
    throw new ServiceError('A gate pass must be "checked out" before it can be marked in transit.');
  }

  const { data, error } = await client.from("gate_passes").update({ status: "in_transit" }).eq("id", gatePassId).select("*").single();
  if (error) throw new ServiceError("Could not update the gate pass's status.", error);
  return mapGatePassRow(data);
}

/**
 * Records the return of one or more gate pass items (each with its own
 * `good`/`damaged`/`lost` condition, so a single manifest can return mixed
 * conditions across its items — e.g. one speaker back in good condition,
 * one microphone lost). For each item:
 *
 *  1. Rejects an item that isn't on this gate pass, or that was already
 *     returned (same `returned_at` guard as Uniforms/Assets).
 *  2. Closes out the corresponding OPEN `asset_assignments` row for
 *     (asset, event) via `inventory.returnAssignment` — found by
 *     `listAssignmentsForTarget('event', gatePass.eventId)` filtered to
 *     this asset with `returnedAt == null`. The database's own partial
 *     unique index (0010) guarantees at most one such row exists per
 *     (asset, event) at a time, so this lookup is unambiguous. If no open
 *     assignment is found (e.g. it was independently returned via the
 *     Assets module directly, bypassing this gate pass) the item's own
 *     return is still recorded — a documented, low-severity data-
 *     consistency edge case, not a security boundary, same class as this
 *     codebase's other accepted TOCTOU races (docs/PHASE_8_1.md §2.3,
 *     docs/PHASE_8_2.md §2.3). A `damaged` condition auto-generates a
 *     damage report string, since `returnAssignment` requires one and
 *     collecting a SECOND, separate damage report here (on top of the
 *     gate pass's own return-condition selector) would just be duplicate
 *     data entry for the same physical event.
 *  3. Updates the gate_pass_item row itself (`returned_at`,
 *     `return_condition`).
 *
 * Once every item on the gate pass has been returned, recomputes the gate
 * pass's own overall `status` from the full, current set of items: any
 * still-outstanding item -> `partially_returned`; else, if any returned
 * item is `lost` -> `lost` (worst outcome wins); else if any is `damaged`
 * -> `damaged`; else -> `returned`. Not atomic across the several writes
 * involved — same documented, non-silent limitation as every other multi-
 * step write in this codebase.
 */
export async function returnGatePassItems(
  client: SupabaseClient<Database>,
  gatePassId: string,
  itemReturns: ReturnGatePassItemInput[]
): Promise<GatePass> {
  if (itemReturns.length === 0) throw new ServiceError("Select at least one item to return.");

  const { data: gatePassRow, error: gatePassError } = await client.from("gate_passes").select("*").eq("id", gatePassId).maybeSingle();
  if (gatePassError) throw new ServiceError("Could not load the gate pass.", gatePassError);
  if (!gatePassRow) throw new ServiceError("Gate pass not found.");
  if (gatePassRow.status !== "checked_out" && gatePassRow.status !== "in_transit") {
    throw new ServiceError('A gate pass must be "checked out" or "in transit" before its items can be returned.');
  }

  const openAssignments = await listAssignmentsForTarget(client, "event", gatePassRow.event_id);

  for (const itemReturn of itemReturns) {
    const { data: itemRow, error: itemError } = await client
      .from("gate_pass_items")
      .select("*")
      .eq("id", itemReturn.itemId)
      .maybeSingle();
    if (itemError) throw new ServiceError("Could not load a gate pass item.", itemError);
    if (!itemRow || itemRow.gate_pass_id !== gatePassId) throw new ServiceError("That item does not belong to this gate pass.");
    if (itemRow.returned_at) throw new ServiceError("This item has already been returned.");

    const openAssignment = openAssignments.find((a) => a.assetId === itemRow.asset_id && !a.returnedAt);
    if (openAssignment) {
      await returnAssignment(client, {
        assignmentId: openAssignment.id,
        returnCondition: itemReturn.condition,
        damageReport: itemReturn.condition === "damaged" ? "Reported via gate pass return." : undefined,
      });
    }

    const { error: updateError } = await client
      .from("gate_pass_items")
      .update({ returned_at: new Date().toISOString(), return_condition: itemReturn.condition })
      .eq("id", itemReturn.itemId);
    if (updateError) throw new ServiceError("Could not record the item's return.", updateError);
  }

  const { data: allItems, error: allItemsError } = await client.from("gate_pass_items").select("*").eq("gate_pass_id", gatePassId);
  if (allItemsError) throw new ServiceError("Could not reload the gate pass's items.", allItemsError);
  const items = (allItems ?? []).map(mapGatePassItemRow);

  const stillOutstanding = items.some((i) => !i.returnedAt);
  const overallStatus = stillOutstanding
    ? "partially_returned"
    : items.some((i) => i.returnCondition === "lost")
      ? "lost"
      : items.some((i) => i.returnCondition === "damaged")
        ? "damaged"
        : "returned";

  const { data, error } = await client.from("gate_passes").update({ status: overallStatus }).eq("id", gatePassId).select("*").single();
  if (error) throw new ServiceError("The item return(s) were recorded, but the gate pass's overall status could not be updated.", error);
  return mapGatePassRow(data);
}
