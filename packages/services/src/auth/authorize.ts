import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError } from "./errors";

/**
 * Defense-in-depth permission check, mirroring the SQL `has_permission()`
 * function (supabase/migrations/0001_extensions_and_helpers.sql) but taking
 * an explicit `userId` instead of relying on `auth.uid()`. This matters
 * because `auth.uid()` is only populated inside a request carrying the
 * caller's own JWT — it reads as NULL when called through the elevated
 * service-role client (packages/db/service-role-client.ts), which is
 * exactly the client that bypasses RLS and therefore most needs an
 * explicit, non-bypassable check before a privileged write.
 *
 * RLS remains the PRIMARY authorization boundary (spec: enforce at the
 * database layer, not just in application code) — every table a normal
 * user reads/writes through the anon-key client is still gated by its own
 * RLS policy regardless of what this function returns. This function exists
 * only for the narrower set of operations that must run through the
 * service-role client (e.g. assignRole below, or a future
 * approve-application-and-issue-member-id transaction) precisely because
 * they need to bypass RLS for part of the operation — see
 * service-role-client.ts's doc comment, which names this convention.
 */
export async function authorize(
  client: SupabaseClient<Database>,
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const { data: permissionRow, error: permissionError } = await client
    .from("permissions")
    .select("id")
    .eq("code", permissionCode)
    .maybeSingle();

  if (permissionError) {
    throw new AuthServiceError("Could not resolve permission code.", permissionError);
  }
  if (!permissionRow) {
    // Unknown permission code — fail closed rather than throwing, so a
    // typo in a caller's permission-code string denies access instead of
    // crashing the request.
    return false;
  }

  const { data: roleRows, error: roleError } = await client
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (roleError) {
    throw new AuthServiceError("Could not resolve the caller's active roles.", roleError);
  }

  const roleIds = [...new Set((roleRows ?? []).map((r) => r.role_id))];
  if (roleIds.length === 0) {
    return false;
  }

  const { data: grantRows, error: grantError } = await client
    .from("role_permissions")
    .select("role_id")
    .in("role_id", roleIds)
    .eq("permission_id", permissionRow.id)
    .limit(1);

  if (grantError) {
    throw new AuthServiceError("Could not resolve role permission grants.", grantError);
  }

  return (grantRows ?? []).length > 0;
}
