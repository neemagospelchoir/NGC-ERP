import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { ExpenseCategoryOption } from "./types";

/**
 * Expense categories are admin-configurable data (`lookup_values`,
 * category='expense_category' — seed: transport, equipment, catering,
 * printing, accommodation, other), not a hardcoded enum, matching the same
 * convention `uniforms/categories.ts`/`attendance/statuses.ts`/`discipline/
 * categories.ts` already established for their own admin-configurable
 * category lists.
 */
export async function listExpenseCategories(client: SupabaseClient<Database>): Promise<ExpenseCategoryOption[]> {
  const { data, error } = await client
    .from("lookup_values")
    .select("*")
    .eq("category", "expense_category")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new ServiceError("Could not load expense categories.", error);
  return (data ?? []).map((row) => ({ code: row.code, label: row.label }));
}
