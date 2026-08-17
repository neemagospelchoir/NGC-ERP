import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { assignUniform, returnUniformAssignment } from "./assign";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const UNIFORM: FakeRow[] = [
  { id: "uni-1", uniform_type: "choir_robe", quantity_total: 10, quantity_available: 10, condition: "good" },
];

test("assignUniform decrements quantity_available by the issued amount", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM, uniform_assignments: [] });
  const assignment = await assignUniform(asClient(fake), { uniformId: "uni-1", memberId: "member-1", quantity: 3 });
  assert.equal(assignment.quantity, 3);
  assert.equal(assignment.status, "assigned");

  const uniforms = fake.__db.get("uniforms") as FakeRow[];
  assert.equal(uniforms[0]?.quantity_available, 7);
});

test("assignUniform defaults quantity to 1 and refuses less than 1", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORM, uniform_assignments: [] });
  const assignment = await assignUniform(asClient(fake), { uniformId: "uni-1", memberId: "member-1" });
  assert.equal(assignment.quantity, 1);
  await assert.rejects(() => assignUniform(asClient(fake), { uniformId: "uni-1", memberId: "member-1", quantity: 0 }), ServiceError);
});

test("assignUniform refuses to over-issue beyond quantity_available", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_available: 2, condition: "good" }],
    uniform_assignments: [],
  });
  await assert.rejects(() => assignUniform(asClient(fake), { uniformId: "uni-1", memberId: "member-1", quantity: 3 }), ServiceError);
});

test("assignUniform refuses a retired uniform regardless of quantity_available", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_available: 5, condition: "retired" }],
    uniform_assignments: [],
  });
  await assert.rejects(() => assignUniform(asClient(fake), { uniformId: "uni-1", memberId: "member-1" }), ServiceError);
});

test("returnUniformAssignment with condition=good restores quantity_available", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_total: 10, quantity_available: 7 }],
    uniform_assignments: [{ id: "assign-1", uniform_id: "uni-1", quantity: 3, returned_at: null }],
  });
  const result = await returnUniformAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "good" });
  assert.equal(result.status, "returned");

  const uniforms = fake.__db.get("uniforms") as FakeRow[];
  assert.equal(uniforms[0]?.quantity_available, 10);
});

test("returnUniformAssignment with condition=damaged does not restock quantity_available", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_total: 10, quantity_available: 7 }],
    uniform_assignments: [{ id: "assign-1", uniform_id: "uni-1", quantity: 3, returned_at: null }],
  });
  const result = await returnUniformAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "damaged" });
  assert.equal(result.status, "damaged");

  const uniforms = fake.__db.get("uniforms") as FakeRow[];
  assert.equal(uniforms[0]?.quantity_available, 7); // unchanged
  assert.equal(uniforms[0]?.quantity_total, 10); // unchanged
});

test("returnUniformAssignment with condition=lost permanently reduces quantity_total, clamped at zero", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_total: 2, quantity_available: 0 }],
    uniform_assignments: [{ id: "assign-1", uniform_id: "uni-1", quantity: 5, returned_at: null }],
  });
  const result = await returnUniformAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "lost" });
  assert.equal(result.status, "lost");

  const uniforms = fake.__db.get("uniforms") as FakeRow[];
  assert.equal(uniforms[0]?.quantity_total, 0); // clamped, never negative
});

test("returnUniformAssignment with condition=good does NOT restore quantity_available for a retired uniform", async () => {
  // Security-review-driven regression test: retiring a uniform force-zeroes
  // quantity_available as its terminal-state marker (update.ts's
  // setUniformCondition). If units were outstanding at the time of
  // retirement and are later returned as "good", quantity_available must
  // stay at zero — restoring it would contradict the "retired uniforms show
  // 0 available" invariant surfaced throughout the UI, even though
  // assignUniform's own `condition === "retired"` check independently
  // blocks re-issuance regardless of this count.
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_total: 10, quantity_available: 0, condition: "retired" }],
    uniform_assignments: [{ id: "assign-1", uniform_id: "uni-1", quantity: 3, returned_at: null }],
  });
  const result = await returnUniformAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "good" });
  assert.equal(result.status, "returned");

  const uniforms = fake.__db.get("uniforms") as FakeRow[];
  assert.equal(uniforms[0]?.quantity_available, 0); // stays zero, not re-inflated to 3
});

test("returnUniformAssignment refuses to return an assignment twice", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: [{ id: "uni-1", quantity_total: 10, quantity_available: 7 }],
    uniform_assignments: [{ id: "assign-1", uniform_id: "uni-1", quantity: 3, returned_at: "2026-01-01T00:00:00.000Z" }],
  });
  await assert.rejects(() => returnUniformAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "good" }), ServiceError);
});
