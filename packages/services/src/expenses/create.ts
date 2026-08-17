import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapExpenseRequestRow } from "./map";
import type { CreateExpenseRequestInput, ExpenseRequest } from "./types";

const EXPENSE_REQUEST_NUMBER_SEQUENCE_KEY = "expense_request_number";
const EXPENSE_REQUEST_NUMBER_SETTING_KEY = "id_format.expense_request_number";
/** Only used if system_settings is somehow missing the row every seed applies — see createGatePass's/createAsset's identical fallback rationale. */
const FALLBACK_EXPENSE_REQUEST_NUMBER_FORMAT = "EXP-{year}-{sequence}";

/**
 * Creates an expense request in `'draft'` status (PRD §7.16) — any member
 * may create one for themselves, matching `expense_requests_insert_self`
 * RLS (0014)'s `requested_by = auth.uid()` self-service shape exactly, not
 * a permission-gated management action. Mirrors `createGatePass`'s
 * organization-configurable ID generation convention (`system_settings.
 * id_format.expense_request_number`, already seeded since Phase 4, passed
 * to `next_formatted_id()`).
 *
 * A draft is not yet visible to any approver — `submitExpenseRequestForApproval`
 * (workflow.ts) is the separate, explicit action that moves it into the
 * approval chain.
 */
export async function createExpenseRequest(
  client: SupabaseClient<Database>,
  input: CreateExpenseRequestInput
): Promise<ExpenseRequest> {
  const description = input.description.trim();
  if (!description) throw new ServiceError("A description is required.");
  if (!(input.amount >= 0)) throw new ServiceError("Amount must be zero or a positive number.");
  if (!input.requestedBy) throw new ServiceError("A requester is required.");

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", EXPENSE_REQUEST_NUMBER_SETTING_KEY)
    .maybeSingle();
  if (formatError) throw new ServiceError("Could not resolve the expense request number format.", formatError);
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_EXPENSE_REQUEST_NUMBER_FORMAT;

  const { data: requestNumber, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: EXPENSE_REQUEST_NUMBER_SEQUENCE_KEY,
    p_format: format,
  });
  if (rpcError || !requestNumber) throw new ServiceError("Could not generate an expense request number.", rpcError);

  const { data, error } = await client
    .from("expense_requests")
    .insert({
      request_number: requestNumber,
      requested_by: input.requestedBy,
      description,
      amount: input.amount,
      currency: input.currency?.trim() || "TZS",
      category: input.category ?? null,
      department_id: input.departmentId ?? null,
      event_id: input.eventId ?? null,
      supporting_document_id: input.supportingDocumentId ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the expense request.", error);
  return mapExpenseRequestRow(data);
}
