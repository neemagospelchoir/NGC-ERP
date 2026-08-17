import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapDepartmentRow } from "./map";
import type { CreateDepartmentInput, Department } from "./types";

/**
 * Creates a department. No application-layer permission check is needed
 * here: this runs through the RLS-scoped client (never the service-role
 * client), so `departments_write_admin`'s `has_permission('admin.departments.manage')`
 * check is enforced by Postgres itself on the INSERT — a non-privileged
 * caller gets a real RLS denial, not a client-side illusion of one.
 */
export async function createDepartment(
  client: SupabaseClient<Database>,
  input: CreateDepartmentInput
): Promise<Department> {
  const name = input.name.trim();
  if (!name) {
    throw new ServiceError("Department name is required.");
  }

  const { data, error } = await client
    .from("departments")
    .insert({
      name,
      description: input.description ?? null,
      leader_user_id: input.leaderUserId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError(`A department named "${name}" already exists.`, error);
    }
    throw new ServiceError("Could not create the department.", error);
  }

  return mapDepartmentRow(data);
}
