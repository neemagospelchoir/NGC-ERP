import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listUniforms, getUniform, listUniformAssignments, listAssignmentsForMember, listUniformAssignmentsInPeriod } from "./list";
import { listUniformCategories } from "./categories";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const UNIFORMS: FakeRow[] = [
  { id: "uni-1", uniform_type: "choir_robe", condition: "good", quantity_total: 10, quantity_available: 6 },
  { id: "uni-2", uniform_type: "t_shirt", condition: "retired", quantity_total: 5, quantity_available: 0 },
];

test("listUniforms filters by condition", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORMS });
  const retired = await listUniforms(asClient(fake), { condition: "retired" });
  assert.equal(retired.length, 1);
  assert.equal(retired[0]?.uniformType, "t_shirt");
});

test("getUniform returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORMS });
  assert.equal(await getUniform(asClient(fake), "does-not-exist"), null);
});

test("listUniformAssignments and listAssignmentsForMember scope by the expected column", async () => {
  const fake = createFakeSupabaseClient({
    uniform_assignments: [
      { id: "a1", uniform_id: "uni-1", member_id: "member-1", assigned_at: "2026-01-01T00:00:00.000Z" },
      { id: "a2", uniform_id: "uni-1", member_id: "member-2", assigned_at: "2026-01-02T00:00:00.000Z" },
      { id: "a3", uniform_id: "uni-2", member_id: "member-1", assigned_at: "2026-01-03T00:00:00.000Z" },
    ],
  });
  const byUniform = await listUniformAssignments(asClient(fake), "uni-1");
  assert.equal(byUniform.length, 2);

  const byMember = await listAssignmentsForMember(asClient(fake), "member-1");
  assert.equal(byMember.length, 2);
});

test("listUniformAssignmentsInPeriod scopes by assigned_at and resolves member/uniform names — added for Phase 13.2's Uniform Report", async () => {
  const fake = createFakeSupabaseClient({
    uniforms: UNIFORMS,
    members: [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga" }],
    uniform_assignments: [
      { id: "a1", uniform_id: "uni-1", member_id: "member-1", assigned_at: "2026-02-05T00:00:00.000Z" },
      { id: "a2", uniform_id: "uni-2", member_id: "member-1", assigned_at: "2026-05-01T00:00:00.000Z" }, // outside the period
    ],
  });
  const result = await listUniformAssignmentsInPeriod(asClient(fake), { assignedFrom: "2026-02-01", assignedTo: "2026-02-28" });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.memberName, "Asha Mwakalinga");
  assert.equal(result[0]?.uniformLabel, "choir_robe");
});

test("listUniformCategories returns only active lookup_values in sort order", async () => {
  const fake = createFakeSupabaseClient({
    lookup_values: [
      { id: "lv-1", category: "uniform_category", code: "choir_robe", label: "Choir Robe", is_active: true, sort_order: 1 },
      { id: "lv-2", category: "uniform_category", code: "t_shirt", label: "T-Shirt", is_active: true, sort_order: 2 },
      { id: "lv-3", category: "uniform_category", code: "old", label: "Old", is_active: false, sort_order: 0 },
      { id: "lv-4", category: "attendance_status", code: "present", label: "Present", is_active: true, sort_order: 1 },
    ],
  });
  const result = await listUniformCategories(asClient(fake));
  assert.deepEqual(result.map((c) => c.code), ["choir_robe", "t_shirt"]);
});
