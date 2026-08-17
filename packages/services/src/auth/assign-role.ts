import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError } from "./errors";
import { authorize } from "./authorize";

export interface AssignRoleInput {
  /** The signed-in admin performing the assignment — used for the explicit authorize() check and recorded as user_roles.granted_by. */
  actorUserId: string;
  targetUserId: string;
  roleCode: string;
  scopeType?: "department" | "family" | null;
  scopeId?: string | null;
}

/**
 * Grants a role to a user. This is an ADMIN action (spec: "AI may only
 * assist, never autonomously decide"; role/permission changes are always a
 * deliberate human action performed by someone holding
 * `admin.users.manage`) and is written to run through the service-role
 * client precisely because `user_roles` writes are otherwise restricted by
 * its own RLS policy (`user_roles_write_admin`) — but RLS alone is not
 * bypassed silently here: `authorize()` re-checks the same permission
 * explicitly before the insert runs, so this function fails closed even if
 * it is ever accidentally wired to the service-role client without an
 * upstream permission check.
 *
 * The insert itself is picked up by the existing `audit_user_roles` trigger
 * (supabase/migrations — write_audit_log()), so every grant is already
 * auditable without any extra code here (spec: "every important change must
 * be auditable").
 */
export async function assignRole(client: SupabaseClient<Database>, input: AssignRoleInput): Promise<void> {
  const allowed = await authorize(client, input.actorUserId, "admin.users.manage");
  if (!allowed) {
    throw new AuthServiceError("You do not have permission to assign roles.");
  }

  const { data: role, error: roleError } = await client
    .from("roles")
    .select("id")
    .eq("code", input.roleCode)
    .maybeSingle();

  if (roleError) {
    throw new AuthServiceError("Could not resolve the requested role.", roleError);
  }
  if (!role) {
    throw new AuthServiceError(`Unknown role code: "${input.roleCode}".`);
  }

  const { error: insertError } = await client.from("user_roles").insert({
    user_id: input.targetUserId,
    role_id: role.id,
    scope_type: input.scopeType ?? null,
    scope_id: input.scopeId ?? null,
    granted_by: input.actorUserId,
  });

  if (insertError) {
    // The unique constraint on (user_id, role_id, scope_type, scope_id)
    // is the most likely cause — surface a message that covers both that
    // and a genuine DB error without leaking raw Postgres text to a UI.
    throw new AuthServiceError(
      "Could not assign the role. It may already be assigned with the same scope.",
      insertError
    );
  }
}
