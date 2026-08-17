import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { failProbation } from "./fail";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    members: [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001", membership_status: "probation" }],
    applications: [{ id: "app-1", status: "probation" }],
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

test("failProbation requires outcome notes", async () => {
  const fake = seed();
  await assert.rejects(() => failProbation(asClient(fake), "prob-1", { decidedBy: "user-hr", outcomeNotes: "  " }), ServiceError);
});

test("failProbation marks the probation failed, exits the member, and reflects on the application", async () => {
  const fake = seed();
  const result = await failProbation(asClient(fake), "prob-1", {
    decidedBy: "user-hr",
    outcomeNotes: "Repeated unexcused absences during probation.",
  });

  assert.equal(result.status, "failed");

  const member = fake.__db.get("members")?.find((m) => m.id === "member-1");
  assert.equal(member?.membership_status, "exited");
  assert.equal(member?.exit_reason, "Repeated unexcused absences during probation.");
  assert.ok(member?.exited_at);

  const application = fake.__db.get("applications")?.find((a) => a.id === "app-1");
  assert.equal(application?.status, "probation_failed");
});
