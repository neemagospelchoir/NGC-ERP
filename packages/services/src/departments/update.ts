import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapDepartmentRow } from "./map";
import type { Department, UpdateDepartmentInput } from "./types";

export async function updateDepartment(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateDepartmentInput
): Promise<Department> {
  const patch: Database["public"]["Tables"]["departments"]["Update"] = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ServiceError("Department name cannot be empty.");
    patch.name = trimmed;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.leaderUserId !== undefined) patch.leader_user_id = input.leaderUserId;

  const { data, error } = await client.from("departments").update(patch).eq("id", id).select("*").single();

  if (error) {
    throw new ServiceError("Could not update the department.", error);
  }
  return mapDepartmentRow(data);
}

/**
 * Departments are never hard-deleted (spec: never destroy historical data —
 * a department may be referenced by years of attendance/assignment/asset
 * history). "Deleting" one in the UI deactivates it: it drops out of
 * `listDepartments()`'s default view and any active-picker, but every past
 * reference stays intact and queryable.
 */
export async function deactivateDepartment(client: SupabaseClient<Database>, id: string): Promise<Department> {
  return updateDepartmentActiveState(client, id, false);
}

export async function reactivateDepartment(client: SupabaseClient<Database>, id: string): Promise<Department> {
  return updateDepartmentActiveState(client, id, true);
}

async function updateDepartmentActiveState(
  client: SupabaseClient<Database>,
  id: string,
  isActive: boolean
): Promise<Department> {
  const { data, error } = await client
    .from("departments")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError(
      isActive ? "Could not reactivate the department." : "Could not deactivate the department.",
      error
    );
  }
  return mapDepartmentRow(data);
}
