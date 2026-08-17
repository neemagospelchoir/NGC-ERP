import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { authorize } from "./authorize";
import { createFakeSupabaseClient } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const PERMISSIONS = [
  { id: "perm-manage-users", code: "admin.users.manage" },
  { id: "perm-read-users", code: "admin.users.read" },
];

test("authorize returns true when one of the user's active roles grants the permission", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      permissions: PERMISSIONS,
      user_roles: [{ user_id: "user-admin", role_id: "role-admin", revoked_at: null }],
      role_permissions: [{ role_id: "role-admin", permission_id: "perm-manage-users" }],
    }
  );

  const allowed = await authorize(asClient(fake), "user-admin", "admin.users.manage");
  assert.equal(allowed, true);
});

test("authorize returns false when the user has roles but none grant the permission", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      permissions: PERMISSIONS,
      user_roles: [{ user_id: "user-chorister", role_id: "role-chorister", revoked_at: null }],
      role_permissions: [{ role_id: "role-chorister", permission_id: "perm-read-users" }],
    }
  );

  const allowed = await authorize(asClient(fake), "user-chorister", "admin.users.manage");
  assert.equal(allowed, false);
});

test("authorize returns false for a user with no active roles", async () => {
  const fake = createFakeSupabaseClient(
    {},
    { permissions: PERMISSIONS, user_roles: [], role_permissions: [] }
  );

  const allowed = await authorize(asClient(fake), "user-nobody", "admin.users.manage");
  assert.equal(allowed, false);
});

test("authorize ignores a revoked role grant", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      permissions: PERMISSIONS,
      user_roles: [{ user_id: "user-ex-admin", role_id: "role-admin", revoked_at: "2025-01-01T00:00:00Z" }],
      role_permissions: [{ role_id: "role-admin", permission_id: "perm-manage-users" }],
    }
  );

  const allowed = await authorize(asClient(fake), "user-ex-admin", "admin.users.manage");
  assert.equal(allowed, false);
});

test("authorize fails closed (returns false) for an unknown permission code", async () => {
  const fake = createFakeSupabaseClient(
    {},
    {
      permissions: PERMISSIONS,
      user_roles: [{ user_id: "user-admin", role_id: "role-admin", revoked_at: null }],
      role_permissions: [{ role_id: "role-admin", permission_id: "perm-manage-users" }],
    }
  );

  const allowed = await authorize(asClient(fake), "user-admin", "totally.made.up.permission");
  assert.equal(allowed, false);
});
