import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapProcurementRequestRow } from "./map";
import type { ProcurementRequest } from "./types";

/**
 * Records the vendor chosen for a procurement request (PRD §7.17's
 * "Vendor" step) and moves it from `'pending'` to `'vendor_selected'`.
 * Re-reads the request's own current status itself rather than trusting a
 * caller-supplied assumption (the established Phase 9 pattern) and refuses
 * anything but `'pending'` — a vendor cannot be (re-)selected once a
 * purchase has already been recorded or the request was cancelled.
 */
export async function selectVendor(client: SupabaseClient<Database>, id: string, vendorId: string): Promise<ProcurementRequest> {
  if (!vendorId) throw new ServiceError("A vendor is required.");

  const { data: current, error: loadError } = await client.from("procurement_requests").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the procurement request.", loadError);
  if (!current) throw new ServiceError("Procurement request not found.");
  if (current.status !== "pending") {
    throw new ServiceError(`A vendor can only be selected while a procurement request is pending (current status: "${current.status}").`);
  }

  const { data, error } = await client
    .from("procurement_requests")
    .update({ vendor_id: vendorId, status: "vendor_selected" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not select the vendor.", error);
  return mapProcurementRequestRow(data);
}
