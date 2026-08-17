import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { assignAsset } from "../inventory/assign";
import { ServiceError } from "../shared/errors";
import { getWorkflowForRecord } from "../workflow/get-for-record";
import { mapGatePassItemRow } from "./map";
import type { AddGatePassItemInput, GatePassItem } from "./types";

const RECORD_TYPE = "gate_pass";

/**
 * Adds one line item to a gate pass — and this IS the "Technical Department
 * assigns equipment to an approved event" action PRD §7.6 describes, not a
 * separate step that happens elsewhere first: it calls the existing,
 * already-tested `inventory.assignAsset` (Phase 8.1) with `targetType:
 * 'event'`, reusing its availability check, its unconditional
 * `disposed`-is-terminal rule, and the hard database-level double-booking
 * backstop (`uq_asset_assignments_no_concurrent_event_booking`, 0010) —
 * rather than re-implementing any of that here. If `assignAsset` throws
 * (already booked to another event, disposed, unavailable without
 * `override`), the gate pass item is never created; the two records can
 * never disagree about whether the equipment was actually assigned.
 *
 * Only allowed while the gate pass is still `pending_approval` AND has not
 * yet been submitted into its approval workflow (no `workflow_instances`
 * row exists for it yet) — once submitted, the manifest the approvers are
 * deciding on must not silently change out from under them. This mirrors
 * Invitations' RESUME-case carefulness (docs/PHASE_7_5.md §2.3) applied to
 * a "don't mutate what's mid-approval" rule instead.
 *
 * Two things a security review of this phase surfaced, both accepted as
 * documented limitations rather than fixed (see docs/PHASE_8_3.md §4):
 *
 *  - The "no existing instance" check above is a plain, unlocked read —
 *    `start_gate_pass_workflow` (0029) only locks the `gate_passes` row, not
 *    `gate_pass_items`, so a concurrent `addGatePassItem` and
 *    `submitGatePassForApproval` could interleave and add one more item
 *    after the instance already exists. Both calls require the SAME
 *    permission (`inventory.gate_passes.manage`), so this cannot be used by
 *    a lower-privileged actor to smuggle a change past a higher-privileged
 *    approver — same accepted TOCTOU-race class as `inventory.assignAsset`'s
 *    own member/department path (docs/PHASE_8_1.md §2.3), not a privilege
 *    boundary.
 *  - This function is conceptually gated on `inventory.gate_passes.manage`
 *    (via `gate_pass_items_write_scoped` RLS), but `assignAsset` below is
 *    gated by a DIFFERENT permission pair (`inventory.assets.manage` OR
 *    `technical.equipment.assign`). Today every role holding
 *    `technical.equipment.assign` (only `technical_manager`) also holds
 *    `inventory.gate_passes.manage`, so this is not reachable — but if a
 *    future custom role were granted `technical.equipment.assign` alone,
 *    it could cause a real equipment assignment here while the subsequent
 *    `gate_pass_items` insert fails RLS, leaving an orphaned assignment
 *    with no manifest line (the error message below already anticipates
 *    exactly that partial-failure shape). Flagged rather than silently
 *    papered over with an app-layer permission check that would duplicate
 *    RLS for a normal RLS-scoped client — this codebase's established
 *    convention (see `auth/authorize.ts`'s own doc comment) reserves that
 *    kind of check for service-role-client operations, not normal writes.
 */
export async function addGatePassItem(
  client: SupabaseClient<Database>,
  gatePassId: string,
  input: AddGatePassItemInput
): Promise<GatePassItem> {
  if (!input.assetId) throw new ServiceError("An asset is required.");

  const { data: gatePassRow, error: gatePassError } = await client
    .from("gate_passes")
    .select("id, event_id, status")
    .eq("id", gatePassId)
    .maybeSingle();
  if (gatePassError) throw new ServiceError("Could not load the gate pass.", gatePassError);
  if (!gatePassRow) throw new ServiceError("Gate pass not found.");
  if (gatePassRow.status !== "pending_approval") {
    throw new ServiceError("Items can only be added while a gate pass is still pending submission.");
  }

  const existingInstance = await getWorkflowForRecord(client, RECORD_TYPE, gatePassId);
  if (existingInstance) {
    throw new ServiceError("This gate pass has already been submitted for approval — its items can no longer be changed.");
  }

  // Performs the actual equipment-to-event assignment (availability check,
  // double-booking backstop, `availability_status: 'assigned'`) — see this
  // function's own doc comment above.
  await assignAsset(client, {
    assetId: input.assetId,
    targetType: "event",
    targetId: gatePassRow.event_id,
    quantity: input.quantity ?? 1,
    assignedBy: input.assignedBy ?? null,
    expectedReturnAt: input.expectedReturnAt ?? null,
    override: input.override,
  });

  const { data, error } = await client
    .from("gate_pass_items")
    .insert({
      gate_pass_id: gatePassId,
      asset_id: input.assetId,
      quantity: input.quantity ?? 1,
    })
    .select("*")
    .single();
  if (error) {
    throw new ServiceError(
      "The equipment was assigned to the event, but could not be added to the gate pass manifest. Please contact an administrator.",
      error
    );
  }

  return mapGatePassItemRow(data);
}
