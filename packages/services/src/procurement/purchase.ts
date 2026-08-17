import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapPurchaseOrderRow } from "./map";
import type { PurchaseOrder, RecordPurchaseInput } from "./types";

/**
 * Records the actual purchase (PRD §7.17's "Purchase" step) — creates the
 * `purchase_orders` row AND moves the parent procurement request from
 * `'vendor_selected'` to `'purchased'`, atomically from the caller's point
 * of view (two writes, but there is no concurrent-writer scenario this
 * phase's UI can trigger — the same accepted non-atomicity class as
 * `decideExpenseRequestApproval`'s two-step read-then-write, 9.2). Re-reads
 * the procurement request's own current status itself and refuses
 * anything but `'vendor_selected'` — a purchase cannot be recorded before
 * a vendor is chosen, or twice for the same request.
 */
export async function recordPurchase(
  client: SupabaseClient<Database>,
  procurementRequestId: string,
  input: RecordPurchaseInput
): Promise<PurchaseOrder> {
  if (!input.vendorId) throw new ServiceError("A vendor is required.");
  if (!(input.amount >= 0)) throw new ServiceError("Amount must be zero or a positive number.");

  const { data: current, error: loadError } = await client
    .from("procurement_requests")
    .select("status")
    .eq("id", procurementRequestId)
    .maybeSingle();
  if (loadError) throw new ServiceError("Could not load the procurement request.", loadError);
  if (!current) throw new ServiceError("Procurement request not found.");
  if (current.status !== "vendor_selected") {
    throw new ServiceError(`A purchase can only be recorded once a vendor has been selected (current status: "${current.status}").`);
  }

  const { data: order, error: orderError } = await client
    .from("purchase_orders")
    .insert({
      procurement_request_id: procurementRequestId,
      vendor_id: input.vendorId,
      amount: input.amount,
      currency: input.currency?.trim() || "TZS",
      purchased_at: input.purchasedAt ?? new Date().toISOString(),
      payment_status: "unpaid",
    })
    .select("*")
    .single();
  if (orderError) throw new ServiceError("Could not record the purchase.", orderError);

  const { error: statusError } = await client
    .from("procurement_requests")
    .update({ status: "purchased" })
    .eq("id", procurementRequestId);
  if (statusError) {
    throw new ServiceError(
      "The purchase was recorded, but the procurement request's status could not be updated. Please contact an administrator.",
      statusError
    );
  }

  return mapPurchaseOrderRow(order);
}
