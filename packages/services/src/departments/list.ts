import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapDepartmentRow } from "./map";
import type { Department } from "./types";

export interface ListDepartmentsOptions {
  /** Defaults to false — inactive (soft-deactivated) departments are hidden from normal pickers/lists unless explicitly requested (e.g. an admin "show inactive" toggle). */
  includeInactive?: boolean;
}

/**
 * Lists departments. RLS (`departments_read_authenticated`) already limits
 * this to any signed-in user, so there is no separate permission gate here —
 * every authenticated user may see the department directory (spec: only the
 * WRITE side is HR/admin-restricted).
 */
export async function listDepartments(
  client: SupabaseClient<Database>,
  options: ListDepartmentsOptions = {}
): Promise<Department[]> {
  let query = client.from("departments").select("*").order("name", { ascending: true });
  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new ServiceError("Could not load departments.", error);
  }
  return (data ?? []).map(mapDepartmentRow);
}

export async function getDepartment(client: SupabaseClient<Database>, id: string): Promise<Department | null> {
  const { data, error } = await client.from("departments").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new ServiceError("Could not load the department.", error);
  }
  return data ? mapDepartmentRow(data) : null;
}
