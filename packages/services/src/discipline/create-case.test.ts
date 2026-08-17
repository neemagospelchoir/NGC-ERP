import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createCase } from "./create-case";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient(
    {
      system_settings: [{ setting_key: "id_format.disciplinary_case_number", value: "DISC-{year}-{sequence}" }],
      disciplinary_cases: [],
    },
    {
      rpcStubs: {
        find_member_by_number_for_discipline: async (args) =>
          args.p_member_number === "NGC-2026-0050"
            ? { data: [{ id: "member-50", first_name: "Amina", last_name: "Njau", member_number: "NGC-2026-0050", membership_status: "active" }], error: null }
            : { data: [], error: null },
        next_formatted_id: async () => ({ data: "DISC-2026-0001", error: null }),
      },
    }
  );
}

test("createCase resolves the member number, generates a case number, and inserts the case", async () => {
  const fake = seed();
  const created = await createCase(asClient(fake), {
    memberNumber: "NGC-2026-0050",
    category: "conduct",
    incidentDate: "2026-03-01",
    description: "Disruptive behavior during rehearsal.",
    officerId: "user-officer-1",
  });

  assert.equal(created.caseNumber, "DISC-2026-0001");
  assert.equal(created.memberId, "member-50");
  assert.equal(created.memberName, "Amina Njau");
  assert.equal(created.status, "open");

  const rows = fake.__db.get("disciplinary_cases") ?? [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.member_id, "member-50");
});

test("createCase throws when the member number doesn't resolve to anyone", async () => {
  const fake = seed();
  await assert.rejects(() =>
    createCase(asClient(fake), {
      memberNumber: "NGC-2026-9999",
      category: "conduct",
      incidentDate: "2026-03-01",
      description: "Something happened.",
      officerId: "user-officer-1",
    })
  );
});

test("createCase rejects a blank description", async () => {
  const fake = seed();
  await assert.rejects(() =>
    createCase(asClient(fake), {
      memberNumber: "NGC-2026-0050",
      category: "conduct",
      incidentDate: "2026-03-01",
      description: "   ",
      officerId: "user-officer-1",
    })
  );
});
