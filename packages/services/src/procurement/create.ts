import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapProcurementRequestRow } from "./map";
import type { CreateProcurementRequestInput, ProcurementRequest } from "./types";

/**
 * Creates a procurement request for an ALREADY-APPROVED expense request —
 * PRD §7.17's flow is explicitly "Approved expense → Procurement → Vendor
 * → Purchase → Payment → Inventory update," so this re-reads the parent
 * `expense_requests` row's own status itself (never trusting a
 * caller-supplied assumption, the same pattern established across Phase
 * 9 — see docs/PHASE_9_1.md §2.3/docs/PHASE_9_2.md §2.1) and refuses to
 * create one against anything but an `'approved'` expense request. No
 * `workflow_definitions` row exists for `record_type = 'procurement_
 * request'` in the seed, and none is added here — see this module's own
 * `docs/PHASE_9_3.md` §2.1 for why Procurement is treated as implicitly
 * pre-approved once its parent expense request clears its own chain,
 * rather than needing a second, separate approval workflow of its own.
 */
export async function createProcurementRequest(
  client: SupabaseClient<Database>,
  input: CreateProcurementRequestInput
): Promise<ProcurementRequest> {
  if (!input.expenseRequestId) throw new ServiceError("An expense request is required.");
  const description = input.description.trim();
  if (!description) throw new ServiceError("A description is required.");

  const { data: expenseRequest, error: expenseError } = await client
    .from("expense_requests")
    .select("status")
    .eq("id", input.expenseRequestId)
    .maybeSingle();
  if (expenseError) throw new ServiceError("Could not load the expense request.", expenseError);
  if (!expenseRequest) throw new ServiceError("Expense request not found.");
  if (expenseRequest.status !== "approved") {
    throw new ServiceError(`Procurement can only be started for an approved expense request (current status: "${expenseRequest.status}").`);
  }

  const { data, error } = await client
    .from("procurement_requests")
    .insert({
      expense_request_id: input.expenseRequestId,
      vendor_id: input.vendorId ?? null,
      description,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the procurement request.", error);
  return mapProcurementRequestRow(data);
}
