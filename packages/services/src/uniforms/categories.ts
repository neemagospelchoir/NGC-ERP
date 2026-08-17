import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { UniformCategoryOption } from "./types";

/**
 * Uniform types are admin-configurable data (`lookup_values`,
 * category='uniform_category' — 0003/seed: choir_robe, t_shirt, scarf,
 * other), not a hardcoded enum, matching the same convention
 * `attendance/statuses.ts` and `discipline/categories.ts` already
 * established for their own admin-configurable category lists.
 */
export async function listUniformCategories(client: SupabaseClient<Database>): Promise<UniformCategoryOption[]> {
  const { data, error } = await client
    .from("lookup_values")
    .select("*")
    .eq("category", "uniform_category")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new ServiceError("Could not load uniform categories.", error);
  return (data ?? []).map((row) => ({ code: row.code, label: row.label }));
}
