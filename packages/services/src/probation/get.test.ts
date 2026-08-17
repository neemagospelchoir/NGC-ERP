import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getProbation } from "./get";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    members: [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001" }],
    probation: [
      {
        id: "prob-1",
        member_id: "member-1",
        application_id: "app-1",
        started_at: "2026-01-01",
        duration_days: 90,
        deadline: "2026-04-01",
        assigned_department_id: null,
        assigned_family_id: null,
        responsible_leader_id: null,
        status: "active",
        outcome_notes: null,
        decided_by: null,
        decided_at: null,
      },
    ],
  });
}

test("getProbation resolves the member name/number for a single record", async () => {
  const fake = seed();
  const row = await getProbation(asClient(fake), "prob-1");
  assert.equal(row?.memberName, "Asha Mwakalinga");
  assert.equal(row?.memberNumber, "NGC-2026-0001");
});

test("getProbation returns null for an unknown id", async () => {
  const fake = seed();
  const row = await getProbation(asClient(fake), "missing");
  assert.equal(row, null);
});
