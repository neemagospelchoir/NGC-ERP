import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapExpenseRequestRow } from "./map";
import type { ExpenseRequest, UpdateExpenseRequestInput } from "./types";

/**
 * Draft-only editing, matching `expense_requests_update_scoped` RLS (0014)
 * exactly — that policy lets the requester edit their OWN request only
 * while it is still `'draft'`; a Finance Manager/Approver holding `.manage`/
 * `.approve` may update any row regardless of status, but this function's
 * OWN guard below is deliberately narrower than what RLS alone would allow,
 * because nothing in this phase's UI ever offers editing outside "my own
 * still-draft request" in the first place (see actions.ts).
 *
 * This re-reads the request's actual status from the database itself
 * before allowing the edit, rather than trusting any caller-supplied
 * assumption — the same lesson Phase 9.1's security review taught for
 * `contributions.updateCampaign`/`setCampaignStatus` (docs/PHASE_9_1.md
 * §2.3), applied here from the first draft rather than fixed after the
 * fact.
 */
export async function updateExpenseRequest(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateExpenseRequestInput
): Promise<ExpenseRequest> {
  const { data: current, error: loadError } = await client.from("expense_requests").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the expense request.", loadError);
  if (!current) throw new ServiceError("Expense request not found.");
  if (current.status !== "draft") {
    throw new ServiceError(`An expense request can only be edited while it is a draft (current status: "${current.status}").`);
  }

  const fields: Database["public"]["Tables"]["expense_requests"]["Update"] = {};
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (!description) throw new ServiceError("Description cannot be blank.");
    fields.description = description;
  }
  if (input.amount !== undefined) {
    if (!(input.amount >= 0)) throw new ServiceError("Amount must be zero or a positive number.");
    fields.amount = input.amount;
  }
  if (input.currency !== undefined) {
    const currency = input.currency.trim();
    if (!currency) throw new ServiceError("Currency cannot be blank.");
    fields.currency = currency;
  }
  if (input.category !== undefined) fields.category = input.category;
  if (input.departmentId !== undefined) fields.department_id = input.departmentId;
  if (input.eventId !== undefined) fields.event_id = input.eventId;
  if (input.supportingDocumentId !== undefined) fields.supporting_document_id = input.supportingDocumentId;

  if (Object.keys(fields).length === 0) throw new ServiceError("Nothing to update.");

  const { data, error } = await client.from("expense_requests").update(fields).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the expense request.", error);
  return mapExpenseRequestRow(data);
}
