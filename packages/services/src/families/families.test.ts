import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listFamilies, getFamily } from "./list";
import { createFamily } from "./create";
import { updateFamily, deactivateFamily } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const SEED: FakeRow[] = [
  { id: "family-david", name: "David Family", description: null, leader_user_id: null, is_active: true },
  { id: "family-archived", name: "Old Family", description: null, leader_user_id: null, is_active: false },
];

test("listFamilies excludes inactive families by default, includes when asked", async () => {
  const fake = createFakeSupabaseClient({ families: SEED });
  assert.deepEqual(
    (await listFamilies(asClient(fake))).map((f) => f.name),
    ["David Family"]
  );
  assert.equal((await listFamilies(asClient(fake), { includeInactive: true })).length, 2);
});

test("getFamily returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ families: SEED });
  assert.equal(await getFamily(asClient(fake), "nope"), null);
});

test("createFamily validates and trims the name; rejects duplicates", async () => {
  const fake = createFakeSupabaseClient({ families: SEED }, { uniqueColumns: { families: ["name"] } });
  const created = await createFamily(asClient(fake), { name: "  Solomon Family  " });
  assert.equal(created.name, "Solomon Family");

  await assert.rejects(() => createFamily(asClient(fake), { name: "   " }), ServiceError);
  await assert.rejects(() => createFamily(asClient(fake), { name: "David Family" }), (err: unknown) => {
    assert.ok(err instanceof ServiceError);
    assert.match(err.message, /already exists/);
    return true;
  });
});

test("updateFamily and deactivateFamily", async () => {
  const fake = createFakeSupabaseClient({ families: SEED });
  const updated = await updateFamily(asClient(fake), "family-david", { description: "Founding family" });
  assert.equal(updated.description, "Founding family");

  const deactivated = await deactivateFamily(asClient(fake), "family-david");
  assert.equal(deactivated.isActive, false);
  assert.ok(await getFamily(asClient(fake), "family-david"), "row must still exist after deactivation");
});
