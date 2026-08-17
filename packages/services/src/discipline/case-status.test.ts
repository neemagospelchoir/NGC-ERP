import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { advanceCaseStatus } from "./case-status";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status: string) {
  return createFakeSupabaseClient({
    disciplinary_cases: [
      {
        id: "case-1",
        case_number: "DISC-2026-0001",
        member_id: "member-1",
        category: "conduct",
        incident_date: "2026-01-01",
        description: "Incident",
        evidence_document_ids: [],
        officer_id: "user-officer-1",
        status,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    members: [{ id: "member-1", first_name: "Amina", last_name: "Njau", member_number: "NGC-2026-0050" }],
  });
}

test("advanceCaseStatus moves open to under_investigation", async () => {
  const fake = seed("open");
  const result = await advanceCaseStatus(asClient(fake), "case-1", "under_investigation");
  assert.equal(result.status, "under_investigation");
});

test("advanceCaseStatus refuses to skip ahead or go backward", async () => {
  const fake = seed("open");
  await assert.rejects(() => advanceCaseStatus(asClient(fake), "case-1", "resolved"));
});

test("advanceCaseStatus refuses on an unknown case", async () => {
  const fake = seed("open");
  await assert.rejects(() => advanceCaseStatus(asClient(fake), "case-unknown", "under_investigation"));
});
