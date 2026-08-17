import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapProcurementRequestRow } from "./map";
import type { ProcurementRequest } from "./types";

/**
 * Cancels a procurement request (terminal — matching Contributions'
 * closed/cancelled campaigns and Assets' disposed-is-terminal precedent).
 * Re-reads the request's own status and refuses to cancel one that has
 * already been `'purchased'` — once a real purchase order exists, this
 * module has no "undo a purchase" concept; only vendor-selection and
 * earlier stages can be cancelled.
 */
export async function cancelProcurementRequest(client: SupabaseClient<Database>, id: string): Promise<ProcurementRequest> {
  const { data: current, error: loadError } = await client.from("procurement_requests").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the procurement request.", loadError);
  if (!current) throw new ServiceError("Procurement request not found.");
  if (current.status === "purchased" || current.status === "cancelled") {
    throw new ServiceError(`A "${current.status}" procurement request cannot be cancelled.`);
  }

  const { data, error } = await client.from("procurement_requests").update({ status: "cancelled" }).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not cancel the procurement request.", error);
  return mapProcurementRequestRow(data);
}
