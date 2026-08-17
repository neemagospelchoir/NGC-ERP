import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapExpenseRequestRow } from "./map";
import type { ExpenseRequest } from "./types";

/**
 * Marks an approved expense request as paid (PRD §7.16's "Paid" state),
 * recording when and by what reference. Re-reads the row's current status
 * itself rather than trusting a caller-supplied assumption (the same
 * pattern established across this phase — see `update.ts`'s doc comment
 * and Phase 9.1's security-review fix, docs/PHASE_9_1.md §2.3) and refuses
 * anything but `'approved'`: an unapproved or already-paid/closed request
 * cannot be (re-)marked paid.
 */
export async function markExpensePaid(
  client: SupabaseClient<Database>,
  id: string,
  paymentReference?: string | null
): Promise<ExpenseRequest> {
  const { data: current, error: loadError } = await client.from("expense_requests").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the expense request.", loadError);
  if (!current) throw new ServiceError("Expense request not found.");
  if (current.status !== "approved") {
    throw new ServiceError(`Only an approved expense request can be marked paid (current status: "${current.status}").`);
  }

  const { data, error } = await client
    .from("expense_requests")
    .update({ status: "paid", paid_at: new Date().toISOString(), payment_reference: paymentReference ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not mark the expense request paid.", error);
  return mapExpenseRequestRow(data);
}

/**
 * Closes a paid expense request (PRD §7.16's terminal "Closed" state) —
 * e.g. once Procurement (9.3) has finished acting on it. Terminal: nothing
 * in this phase moves a closed request back to any other status, matching
 * Contributions' closed/cancelled campaigns and Assets' disposed-is-terminal
 * precedent.
 */
export async function closeExpenseRequest(client: SupabaseClient<Database>, id: string): Promise<ExpenseRequest> {
  const { data: current, error: loadError } = await client.from("expense_requests").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the expense request.", loadError);
  if (!current) throw new ServiceError("Expense request not found.");
  if (current.status !== "paid") {
    throw new ServiceError(`Only a paid expense request can be closed (current status: "${current.status}").`);
  }

  const { data, error } = await client.from("expense_requests").update({ status: "closed" }).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not close the expense request.", error);
  return mapExpenseRequestRow(data);
}
