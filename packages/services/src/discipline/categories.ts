import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { DisciplineCategoryOption } from "./types";

/**
 * Discipline categories are admin-configurable data (`lookup_values`,
 * category='discipline_category'), same pattern as attendance's statuses
 * — not a hardcoded enum, since NGC leadership may add/rename categories
 * without a code deploy.
 */
export async function listDisciplineCategories(client: SupabaseClient<Database>): Promise<DisciplineCategoryOption[]> {
  const { data, error } = await client
    .from("lookup_values")
    .select("code, label")
    .eq("category", "discipline_category")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new ServiceError("Could not load discipline categories.", error);
  return (data ?? []).map((row) => ({ code: row.code, label: row.label }));
}
