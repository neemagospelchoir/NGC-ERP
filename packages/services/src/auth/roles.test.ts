import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getCurrentUserWithRoles } from "./roles";
import { AuthServiceError } from "./errors";
import { createFakeSupabaseClient, type FakeRow } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const TABLES: Record<string, FakeRow[]> = {
  users: [{ id: "user-1", email: "lead@ngc.org", display_name: "Asha Lead", is_active: true }],
  members: [
    {
      id: "member-1",
      user_id: "user-1",
      member_number: "NGC-2024-0007",
      first_name: "Asha",
      last_name: "Mwakalinga",
      membership_status: "active",
      primary_department_id: "dept-sopranos",
    },
  ],
  user_roles: [
    { user_id: "user-1", role_id: "role-department-lead", scope_type: "department", scope_id: "dept-sopranos", revoked_at: null },
    { user_id: "user-1", role_id: "role-chorister", scope_type: null, scope_id: null, revoked_at: "2024-01-01T00:00:00Z" },
  ],
  roles: [
    { id: "role-department-lead", code: "department_lead", name: "Department Lead" },
    { id: "role-chorister", code: "chorister", name: "Chorister" },
  ],
  role_permissions: [
    { role_id: "role-department-lead", permission_id: "perm-attendance-record" },
    { role_id: "role-department-lead", permission_id: "perm-leave-approve" },
  ],
  permissions: [
    { id: "perm-attendance-record", code: "attendance.record" },
    { id: "perm-leave-approve", code: "leave.approve" },
  ],
};

test("getCurrentUserWithRoles returns null when there is no authenticated user", async () => {
  const fake = createFakeSupabaseClient({ getUser: async () => ({ data: { user: null }, error: null }) }, TABLES);
  const result = await getCurrentUserWithRoles(asClient(fake));
  assert.equal(result, null);
});

test("getCurrentUserWithRoles assembles profile, member, active-only roles, and flattened permissions", async () => {
  const fake = createFakeSupabaseClient(
    { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    TABLES
  );

  const result = await getCurrentUserWithRoles(asClient(fake));

  assert.ok(result);
  assert.equal(result?.id, "user-1");
  assert.equal(result?.displayName, "Asha Lead");
  assert.equal(result?.member?.memberNumber, "NGC-2024-0007");

  // Only the non-revoked role should appear.
  assert.equal(result?.roles.length, 1);
  assert.equal(result?.roles[0]?.code, "department_lead");
  assert.equal(result?.roles[0]?.scopeType, "department");
  assert.equal(result?.roles[0]?.scopeId, "dept-sopranos");

  assert.deepEqual([...(result?.permissionCodes ?? [])].sort(), ["attendance.record", "leave.approve"]);
});

test("getCurrentUserWithRoles handles a user with no member record yet (e.g. mid-onboarding)", async () => {
  const fake = createFakeSupabaseClient(
    { getUser: async () => ({ data: { user: { id: "user-2" } }, error: null }) },
    {
      ...TABLES,
      users: [{ id: "user-2", email: "new@ngc.org", display_name: "New User", is_active: true }],
      members: [],
      user_roles: [],
    }
  );

  const result = await getCurrentUserWithRoles(asClient(fake));
  assert.ok(result);
  assert.equal(result?.member, null);
  assert.deepEqual(result?.roles, []);
  assert.deepEqual(result?.permissionCodes, []);
});

test("getCurrentUserWithRoles throws if the auth user has no public.users profile row", async () => {
  const fake = createFakeSupabaseClient(
    { getUser: async () => ({ data: { user: { id: "user-ghost" } }, error: null }) },
    TABLES
  );

  await assert.rejects(() => getCurrentUserWithRoles(asClient(fake)), AuthServiceError);
});
