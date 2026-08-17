import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listProbations } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    members: [
      { id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001" },
      { id: "member-2", first_name: "Baraka", last_name: "Kessy", member_number: "NGC-2026-0002" },
    ],
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
      {
        id: "prob-2",
        member_id: "member-2",
        application_id: "app-2",
        started_at: "2026-01-01",
        duration_days: 90,
        deadline: "2026-04-01",
        assigned_department_id: null,
        assigned_family_id: null,
        responsible_leader_id: null,
        status: "completed",
        outcome_notes: "Good standing",
        decided_by: "user-hr",
        decided_at: "2026-04-01T00:00:00.000Z",
      },
    ],
  });
}

test("listProbations resolves member names/numbers via a flat lookup", async () => {
  const fake = seed();
  const rows = await listProbations(asClient(fake));
  assert.equal(rows.length, 2);
  const active = rows.find((r) => r.id === "prob-1");
  assert.equal(active?.memberName, "Asha Mwakalinga");
  assert.equal(active?.memberNumber, "NGC-2026-0001");
});

test("listProbations filters by status", async () => {
  const fake = seed();
  const rows = await listProbations(asClient(fake), { status: "active" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "prob-1");
});
