import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapExpenseRequestRow } from "./map";
import type { ExpenseRequest, ExpenseStatus } from "./types";

export interface ListExpenseRequestsOptions {
  status?: ExpenseStatus;
  /** Inclusive `created_at` range — added for Phase 13.2's Expense Report, the same shape as every other report definition's period filter. */
  createdFrom?: string;
  createdTo?: string;
}

/**
 * Reads every expense request the caller's own RLS session can see —
 * `expense_requests_select_scoped` (0014) already scopes this down to
 * "your own requests" for a caller holding neither `finance.expenses.
 * manage` nor `finance.expenses.approve`, so this single query serves both
 * a Finance Manager's full list and, transparently, a plain member's
 * self-only view (see `listExpenseRequestsForRequester` below for the
 * explicit application-level equivalent used by the "My expense requests"
 * section, the same belt-and-suspenders pairing as Contributions'
 * `listContributionsForMember`/Uniforms' `listAssignmentsForMember`).
 */
export async function listExpenseRequests(client: SupabaseClient<Database>, options: ListExpenseRequestsOptions = {}): Promise<ExpenseRequest[]> {
  let query = client.from("expense_requests").select("*").order("created_at", { ascending: false });
  if (options.status) query = query.eq("status", options.status);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);
  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load expense requests.", error);
  return (data ?? []).map(mapExpenseRequestRow);
}

export async function getExpenseRequest(client: SupabaseClient<Database>, id: string): Promise<ExpenseRequest | null> {
  const { data, error } = await client.from("expense_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the expense request.", error);
  return data ? mapExpenseRequestRow(data) : null;
}

/**
 * The explicit, application-level equivalent of `expense_requests_select_
 * scoped` RLS's self-row clause — used by the "My expense requests"
 * section so a plain member/Department Leader/Technical Manager sees their
 * own requests regardless of whether they also hold a broader Finance
 * permission (mirrors `contributions.listContributionsForMember`,
 * `uniforms.listAssignmentsForMember`).
 */
export async function listExpenseRequestsForRequester(client: SupabaseClient<Database>, requesterId: string): Promise<ExpenseRequest[]> {
  const { data, error } = await client
    .from("expense_requests")
    .select("*")
    .eq("requested_by", requesterId)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load your expense requests.", error);
  return (data ?? []).map(mapExpenseRequestRow);
}
