import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listDepartments, getDepartment } from "./list";
import { createDepartment } from "./create";
import { updateDepartment, deactivateDepartment, reactivateDepartment } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const SEED: FakeRow[] = [
  { id: "dept-sopranos", name: "Sopranos", description: null, leader_user_id: null, is_active: true },
  { id: "dept-altos", name: "Altos", description: null, leader_user_id: null, is_active: true },
  { id: "dept-archived", name: "Old Section", description: null, leader_user_id: null, is_active: false },
];

test("listDepartments excludes inactive departments by default", async () => {
  const fake = createFakeSupabaseClient({ departments: SEED });
  const result = await listDepartments(asClient(fake));
  assert.deepEqual(
    result.map((d) => d.name).sort(),
    ["Altos", "Sopranos"]
  );
});

test("listDepartments includes inactive departments when asked", async () => {
  const fake = createFakeSupabaseClient({ departments: SEED });
  const result = await listDepartments(asClient(fake), { includeInactive: true });
  assert.equal(result.length, 3);
});

test("getDepartment returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ departments: SEED });
  const result = await getDepartment(asClient(fake), "does-not-exist");
  assert.equal(result, null);
});

test("createDepartment trims the name and rejects an empty one", async () => {
  const fake = createFakeSupabaseClient({ departments: [] });
  const created = await createDepartment(asClient(fake), { name: "  Tenors  " });
  assert.equal(created.name, "Tenors");

  await assert.rejects(() => createDepartment(asClient(fake), { name: "   " }), ServiceError);
});

test("createDepartment surfaces a friendly message on a duplicate name", async () => {
  const fake = createFakeSupabaseClient(
    { departments: SEED },
    { uniqueColumns: { departments: ["name"] } }
  );

  await assert.rejects(
    () => createDepartment(asClient(fake), { name: "Sopranos" }),
    (err: unknown) => {
      assert.ok(err instanceof ServiceError);
      assert.match(err.message, /already exists/);
      return true;
    }
  );
});

test("updateDepartment applies only the provided fields", async () => {
  const fake = createFakeSupabaseClient({ departments: SEED });
  const updated = await updateDepartment(asClient(fake), "dept-altos", { description: "Alto section" });
  assert.equal(updated.name, "Altos");
  assert.equal(updated.description, "Alto section");
});

test("deactivateDepartment and reactivateDepartment toggle is_active without deleting the row", async () => {
  const fake = createFakeSupabaseClient({ departments: SEED });
  const deactivated = await deactivateDepartment(asClient(fake), "dept-sopranos");
  assert.equal(deactivated.isActive, false);

  const stillThere = await getDepartment(asClient(fake), "dept-sopranos");
  assert.ok(stillThere, "deactivating must not delete the row");

  const reactivated = await reactivateDepartment(asClient(fake), "dept-sopranos");
  assert.equal(reactivated.isActive, true);
});
