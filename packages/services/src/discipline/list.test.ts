import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listCases, getCase, listActions } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    disciplinary_cases: [
      {
        id: "case-1",
        case_number: "DISC-2026-0001",
        member_id: "member-1",
        category: "conduct",
        incident_date: "2026-01-01",
        description: "First incident",
        evidence_document_ids: [],
        officer_id: "user-officer-1",
        status: "open",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "case-2",
        case_number: "DISC-2026-0002",
        member_id: "member-2",
        category: "financial",
        incident_date: "2026-02-01",
        description: "Second incident",
        evidence_document_ids: [],
        officer_id: "user-officer-1",
        status: "resolved",
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      },
    ],
    disciplinary_actions: [
      {
        id: "action-1",
        case_id: "case-1",
        action_type: "warning",
        decided_by: "user-officer-1",
        decided_at: "2026-01-05T00:00:00.000Z",
        suspension_start_date: null,
        suspension_end_date: null,
        resolution: "Verbal warning issued.",
        restored_by: null,
        restored_at: null,
        restoration_reason: null,
        created_at: "2026-01-05T00:00:00.000Z",
      },
    ],
    members: [
      { id: "member-1", first_name: "Amina", last_name: "Njau", member_number: "NGC-2026-0050" },
      { id: "member-2", first_name: "Baraka", last_name: "Ochieng", member_number: "NGC-2026-0051" },
    ],
  });
}

test("listCases resolves member names via a flat lookup", async () => {
  const fake = seed();
  const cases = await listCases(asClient(fake));
  assert.equal(cases.length, 2);
  assert.ok(cases.find((c) => c.memberName === "Amina Njau"));
  assert.ok(cases.find((c) => c.memberName === "Baraka Ochieng"));
});

test("listCases filters by status", async () => {
  const fake = seed();
  const cases = await listCases(asClient(fake), { status: "resolved" });
  assert.equal(cases.length, 1);
  assert.equal(cases[0]?.caseNumber, "DISC-2026-0002");
});

test("listCases filters by a created_at range — added for Phase 13.2's (permission-gated) Discipline Report", async () => {
  const fake = seed();
  const cases = await listCases(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(cases.map((c) => c.caseNumber), ["DISC-2026-0002"]);
});

test("getCase returns a single case with its member name resolved", async () => {
  const fake = seed();
  const result = await getCase(asClient(fake), "case-1");
  assert.equal(result?.memberName, "Amina Njau");
});

test("getCase returns null for an unknown id", async () => {
  const fake = seed();
  const result = await getCase(asClient(fake), "case-unknown");
  assert.equal(result, null);
});

test("listActions returns every action recorded against a case", async () => {
  const fake = seed();
  const actions = await listActions(asClient(fake), "case-1");
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.actionType, "warning");
});
