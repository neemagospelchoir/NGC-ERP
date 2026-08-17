import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { assignRole } from "./assign-role";
import { AuthServiceError } from "./errors";
import { createFakeSupabaseClient, type FakeRow } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const BASE_TABLES: Record<string, FakeRow[]> = {
  permissions: [{ id: "perm-manage-users", code: "admin.users.manage" }],
  roles: [{ id: "role-department-lead", code: "department_lead" }],
};

test("assignRole inserts a user_roles row when the actor is authorized", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      ...BASE_TABLES,
      user_roles: [{ user_id: "user-admin", role_id: "perm-manage-users-holder", revoked_at: null }],
      role_permissions: [{ role_id: "perm-manage-users-holder", permission_id: "perm-manage-users" }],
    }
  );

  await assignRole(asClient(fake), {
    actorUserId: "user-admin",
    targetUserId: "user-new-lead",
    roleCode: "department_lead",
    scopeType: "department",
    scopeId: "dept-sopranos",
  });

  const inserted = fake.__db.get("user_roles") ?? [];
  const newGrant = inserted.find((r) => r.user_id === "user-new-lead");
  assert.ok(newGrant, "expected a new user_roles row for the target user");
  assert.equal(newGrant?.role_id, "role-department-lead");
  assert.equal(newGrant?.scope_type, "department");
  assert.equal(newGrant?.scope_id, "dept-sopranos");
  assert.equal(newGrant?.granted_by, "user-admin");
});

test("assignRole refuses when the actor lacks admin.users.manage, even via the service-role client", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      ...BASE_TABLES,
      user_roles: [{ user_id: "user-regular", role_id: "role-chorister", revoked_at: null }],
      role_permissions: [],
    }
  );

  await assert.rejects(
    () =>
      assignRole(asClient(fake), {
        actorUserId: "user-regular",
        targetUserId: "user-new-lead",
        roleCode: "department_lead",
      }),
    (err: unknown) => {
      assert.ok(err instanceof AuthServiceError);
      assert.match(err.message, /do not have permission/i);
      return true;
    }
  );

  const inserted = fake.__db.get("user_roles") ?? [];
  assert.equal(
    inserted.some((r) => r.user_id === "user-new-lead"),
    false,
    "no row should have been inserted for the unauthorized attempt"
  );
});

test("assignRole rejects an unknown role code", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      ...BASE_TABLES,
      user_roles: [{ user_id: "user-admin", role_id: "perm-manage-users-holder", revoked_at: null }],
      role_permissions: [{ role_id: "perm-manage-users-holder", permission_id: "perm-manage-users" }],
    }
  );

  await assert.rejects(
    () =>
      assignRole(asClient(fake), {
        actorUserId: "user-admin",
        targetUserId: "user-new-lead",
        roleCode: "does_not_exist",
      }),
    AuthServiceError
  );
});
