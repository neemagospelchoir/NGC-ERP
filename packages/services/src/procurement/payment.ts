import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapPurchaseOrderRow } from "./map";
import type { PurchaseOrder, RecordPaymentInput } from "./types";

/**
 * Records payment against a purchase order (PRD §7.17's "Payment" step).
 * Re-reads the order's own row first (defensive, matching the established
 * Phase 9 pattern) — a purchase order with no `purchased_at` at all cannot
 * be paid, since a purchase must be recorded before payment can follow.
 */
export async function recordPayment(client: SupabaseClient<Database>, id: string, input: RecordPaymentInput): Promise<PurchaseOrder> {
  const { data: current, error: loadError } = await client.from("purchase_orders").select("purchased_at").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the purchase order.", loadError);
  if (!current) throw new ServiceError("Purchase order not found.");
  if (!current.purchased_at) throw new ServiceError("A purchase must be recorded before payment can be recorded.");

  const { data, error } = await client
    .from("purchase_orders")
    .update({ payment_status: input.paymentStatus, paid_at: input.paidAt ?? new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not record the payment.", error);
  return mapPurchaseOrderRow(data);
}
