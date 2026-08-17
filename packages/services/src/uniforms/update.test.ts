import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updateUniform, setUniformCondition } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const UNIFORM: FakeRow[] = [{ id: "uni-1", uniform_type: "choir_robe", size: "L", quantity_total: 10, quantity_available: 6, condition: "good" }];

test("updateUniform applies a partial patch without touching quantities", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM });
  const updated = await updateUniform(asClient(fake), "uni-1", { size: "XL" });
  assert.equal(updated.size, "XL");
  assert.equal(updated.quantityAvailable, 6);
});

test("updateUniform refuses quantityAvailable to exceed quantityTotal, checked against the row's CURRENT other value", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM });
  // quantityAvailable=11 alone would exceed the existing quantityTotal=10.
  await assert.rejects(() => updateUniform(asClient(fake), "uni-1", { quantityAvailable: 11 }), ServiceError);
});

test("updateUniform allows a manual stock correction (e.g. crediting a repaired item back)", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM });
  const updated = await updateUniform(asClient(fake), "uni-1", { quantityAvailable: 8 });
  assert.equal(updated.quantityAvailable, 8);
});

test("updateUniform rejects negative quantities", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM });
  await assert.rejects(() => updateUniform(asClient(fake), "uni-1", { quantityTotal: -1 }), ServiceError);
});

test("setUniformCondition zeroes quantityAvailable when transitioning to retired", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM });
  const updated = await setUniformCondition(asClient(fake), "uni-1", "retired");
  assert.equal(updated.condition, "retired");
  assert.equal(updated.quantityAvailable, 0);
});

test("setUniformCondition leaves quantities untouched for a non-retired condition", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM });
  const updated = await setUniformCondition(asClient(fake), "uni-1", "fair");
  assert.equal(updated.condition, "fair");
  assert.equal(updated.quantityAvailable, 6);
});
