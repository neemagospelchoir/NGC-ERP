import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError } from "./errors";

export interface AssignedRole {
  code: string;
  name: string;
  scopeType: "department" | "family" | null;
  scopeId: string | null;
}

export interface MemberSummary {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  primaryDepartmentId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string;
  isActive: boolean;
  member: MemberSummary | null;
  roles: AssignedRole[];
  /** Flattened, de-duplicated permission codes across every active role — this is what UI nav/route guards should check against, e.g. `permissionCodes.includes("admin.users.manage")`. */
  permissionCodes: string[];
}

/**
 * Resolves "who is signed in, what member record are they, what roles do
 * they hold, and what can they do" in one call. This is the function
 * middleware.ts and Server Components use to build a route guard or a
 * permission-aware nav — see docs/AUTHENTICATION.md.
 *
 * Deliberately issues several flat, single-table queries instead of one
 * nested/embedded select. The generated Database type (packages/db) models
 * each table independently, and Supabase's embedded-resource select syntax
 * (`role_permissions(permission:permissions(code))`) does not type-check
 * cleanly against hand-generated types the way it does against the
 * Supabase-CLI-generated ones with relationship metadata baked in. Flat
 * queries are slightly more round trips but are simple, fully typed, and
 * trivially fakeable in tests (see __fixtures__/fake-supabase-client.ts).
 * A later phase can replace this with a single `get_my_profile()` RPC once
 * the schema's relationship metadata is available to codegen — noted as a
 * follow-up in docs/AUTHENTICATION.md rather than done silently here.
 *
 * Returns null if there is no authenticated user (expected/common, not an
 * error — mirrors getSession()).
 */
export async function getCurrentUserWithRoles(client: SupabaseClient<Database>): Promise<AuthenticatedUser | null> {
  const {
    data: { user: authUser },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("id, email, display_name, is_active")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    throw new AuthServiceError("Could not load the signed-in user's profile.", profileError);
  }
  if (!profile) {
    // A row in auth.users with no matching public.users row is a
    // provisioning bug (spec: every auth user gets a public.users row on
    // sign-up), not a normal "not signed in" state — this should throw.
    throw new AuthServiceError("Signed-in user has no application profile. Contact an administrator.");
  }

  const { data: memberRow, error: memberError } = await client
    .from("members")
    .select("id, member_number, first_name, last_name, membership_status, primary_department_id")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (memberError) {
    throw new AuthServiceError("Could not load the signed-in user's member record.", memberError);
  }

  const { data: userRoleRows, error: userRoleError } = await client
    .from("user_roles")
    .select("role_id, scope_type, scope_id")
    .eq("user_id", authUser.id)
    .is("revoked_at", null);

  if (userRoleError) {
    throw new AuthServiceError("Could not load the signed-in user's roles.", userRoleError);
  }

  const roleIds = [...new Set((userRoleRows ?? []).map((r) => r.role_id))];

  let roleDetailsById = new Map<string, { code: string; name: string }>();
  if (roleIds.length > 0) {
    const { data: roleRows, error: roleError } = await client
      .from("roles")
      .select("id, code, name")
      .in("id", roleIds);

    if (roleError) {
      throw new AuthServiceError("Could not load role definitions.", roleError);
    }
    roleDetailsById = new Map((roleRows ?? []).map((r) => [r.id, { code: r.code, name: r.name }]));
  }

  const roles: AssignedRole[] = (userRoleRows ?? []).map((ur) => {
    const details = roleDetailsById.get(ur.role_id);
    return {
      code: details?.code ?? "unknown",
      name: details?.name ?? "Unknown role",
      scopeType: (ur.scope_type as "department" | "family" | null) ?? null,
      scopeId: ur.scope_id ?? null,
    };
  });

  let permissionCodes: string[] = [];
  if (roleIds.length > 0) {
    const { data: grantRows, error: grantError } = await client
      .from("role_permissions")
      .select("permission_id")
      .in("role_id", roleIds);

    if (grantError) {
      throw new AuthServiceError("Could not load role permission grants.", grantError);
    }
    const permissionIds = [...new Set((grantRows ?? []).map((g) => g.permission_id))];

    if (permissionIds.length > 0) {
      const { data: permissionRows, error: permissionError } = await client
        .from("permissions")
        .select("code")
        .in("id", permissionIds);

      if (permissionError) {
        throw new AuthServiceError("Could not load permission definitions.", permissionError);
      }
      permissionCodes = [...new Set((permissionRows ?? []).map((p) => p.code))];
    }
  }

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    isActive: profile.is_active,
    member: memberRow
      ? {
          id: memberRow.id,
          memberNumber: memberRow.member_number,
          firstName: memberRow.first_name,
          lastName: memberRow.last_name,
          membershipStatus: memberRow.membership_status,
          primaryDepartmentId: memberRow.primary_department_id,
        }
      : null,
    roles,
    permissionCodes,
  };
}
