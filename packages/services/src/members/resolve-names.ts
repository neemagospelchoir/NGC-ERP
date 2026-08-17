import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];

/**
 * Resolves department/family display names for a set of member rows with
 * two flat queries (one per table), rather than an embedded PostgREST
 * select — same rationale as auth/roles.ts in Phase 6 (the hand-generated
 * Database type doesn't carry relationship metadata, so nested selects
 * don't type-check cleanly against it; flat queries do, at the cost of a
 * couple of extra round trips).
 */
export async function resolveDepartmentAndFamilyNames(
  client: SupabaseClient<Database>,
  rows: MemberRow[]
): Promise<{ departmentNamesById: Map<string, string>; familyNamesById: Map<string, string> }> {
  const departmentIds = [...new Set(rows.map((r) => r.primary_department_id).filter((id): id is string => !!id))];
  const familyIds = [...new Set(rows.map((r) => r.family_id).filter((id): id is string => !!id))];

  const departmentNamesById = new Map<string, string>();
  if (departmentIds.length > 0) {
    const { data, error } = await client.from("departments").select("id, name").in("id", departmentIds);
    if (error) throw new ServiceError("Could not resolve department names.", error);
    for (const d of data ?? []) departmentNamesById.set(d.id, d.name);
  }

  const familyNamesById = new Map<string, string>();
  if (familyIds.length > 0) {
    const { data, error } = await client.from("families").select("id, name").in("id", familyIds);
    if (error) throw new ServiceError("Could not resolve family names.", error);
    for (const f of data ?? []) familyNamesById.set(f.id, f.name);
  }

  return { departmentNamesById, familyNamesById };
}
