import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createUniform } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const CHOIR_ROBE_LOOKUP: FakeRow[] = [{ id: "lv-1", category: "uniform_category", code: "choir_robe", label: "Choir Robe", is_active: true }];

test("createUniform validates the uniform type against active lookup_values", async () => {
  const fake = createFakeSupabaseClient({ lookup_values: CHOIR_ROBE_LOOKUP, uniforms: [] });
  await assert.rejects(
    () => createUniform(asClient(fake), { uniformType: "not_a_real_type", quantityTotal: 10 }),
    ServiceError
  );

  const created = await createUniform(asClient(fake), { uniformType: "choir_robe", quantityTotal: 10 });
  assert.equal(created.uniformType, "choir_robe");
  assert.equal(created.quantityTotal, 10);
  assert.equal(created.quantityAvailable, 10); // starts fully available
  assert.equal(created.condition, "new"); // default
});

test("createUniform rejects a negative or non-finite total quantity", async () => {
  const fake = createFakeSupabaseClient({ lookup_values: CHOIR_ROBE_LOOKUP, uniforms: [] });
  await assert.rejects(() => createUniform(asClient(fake), { uniformType: "choir_robe", quantityTotal: -1 }), ServiceError);
});
