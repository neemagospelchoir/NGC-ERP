import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runUniformsReport } from "./uniforms";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const UNIFORMS: FakeRow[] = [{ id: "uni-1", uniform_type: "choir_robe", condition: "good" }];
const MEMBERS: FakeRow[] = [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga" }];
const ASSIGNMENTS: FakeRow[] = [
  { id: "a1", uniform_id: "uni-1", member_id: "member-1", quantity: 1, assigned_at: "2026-02-05T00:00:00.000Z", status: "assigned", returned_at: null },
  { id: "a2", uniform_id: "uni-1", member_id: "member-1", quantity: 1, assigned_at: "2026-05-01T00:00:00.000Z", status: "assigned", returned_at: null },
];

test("runUniformsReport scopes by assigned_at within the resolved period and resolves names", async () => {
  const fake = createFakeSupabaseClient({ uniforms: UNIFORMS, members: MEMBERS, uniform_assignments: ASSIGNMENTS });
  const result = await runUniformsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.memberName, "Asha Mwakalinga");
  assert.equal(result.rows[0]?.uniformLabel, "choir_robe");
});
