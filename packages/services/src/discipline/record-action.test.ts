import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { recordAction } from "./record-action";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "open") {
  return createFakeSupabaseClient(
    {
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
      disciplinary_actions: [],
      members: [{ id: "member-1", first_name: "Amina", last_name: "Njau", member_number: "NGC-2026-0050", membership_status: "active" }],
    },
    {
      rpcStubs: {
        apply_disciplinary_membership_status: async () => ({ data: null, error: null }),
      },
    }
  );
}

test("recordAction inserts a warning with no membership_status side effect and advances case status", async () => {
  const fake = seed("open");
  const action = await recordAction(asClient(fake), { caseId: "case-1", actionType: "warning", decidedBy: "user-officer-1", resolution: "Verbal warning." });
  assert.equal(action.actionType, "warning");

  const cases = fake.__db.get("disciplinary_cases") ?? [];
  assert.equal(cases[0]?.status, "action_decided");
});

test("recordAction requires a start date for a suspension", async () => {
  const fake = seed();
  await assert.rejects(() => recordAction(asClient(fake), { caseId: "case-1", actionType: "suspension", decidedBy: "user-officer-1" }));
});

test("recordAction calls apply_disciplinary_membership_status(suspended) for a suspension", async () => {
  const fake = seed();
  let seenArgs: Record<string, unknown> | undefined;
  const wrapped = {
    ...fake,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "apply_disciplinary_membership_status") seenArgs = args;
      return { data: null, error: null };
    },
  };
  await recordAction(asClient(wrapped as unknown as ReturnType<typeof createFakeSupabaseClient>), {
    caseId: "case-1",
    actionType: "suspension",
    decidedBy: "user-officer-1",
    suspensionStartDate: "2026-02-01",
  });
  assert.equal(seenArgs?.p_member_id, "member-1");
  assert.equal(seenArgs?.p_status, "suspended");
});

test("recordAction calls apply_disciplinary_membership_status(exited) for a dismissal, with a reason referencing the case", async () => {
  const fake = seed();
  let seenArgs: Record<string, unknown> | undefined;
  const wrapped = {
    ...fake,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "apply_disciplinary_membership_status") seenArgs = args;
      return { data: null, error: null };
    },
  };
  await recordAction(asClient(wrapped as unknown as ReturnType<typeof createFakeSupabaseClient>), {
    caseId: "case-1",
    actionType: "dismissal",
    decidedBy: "user-officer-1",
  });
  assert.equal(seenArgs?.p_status, "exited");
  assert.ok(String(seenArgs?.p_exit_reason).includes("DISC-2026-0001"));
});

test("recordAction does not advance case status if it's already resolved", async () => {
  const fake = seed("resolved");
  await recordAction(asClient(fake), { caseId: "case-1", actionType: "warning", decidedBy: "user-officer-1" });
  const cases = fake.__db.get("disciplinary_cases") ?? [];
  assert.equal(cases[0]?.status, "resolved");
});

test("recordAction refuses a second suspension while the first is still active (unrestored)", async () => {
  const fake = seed("action_decided");
  fake.__db.set("disciplinary_actions", [
    {
      id: "action-1",
      case_id: "case-1",
      action_type: "suspension",
      decided_by: "user-officer-1",
      decided_at: "2026-01-05T00:00:00.000Z",
      suspension_start_date: "2026-01-05",
      suspension_end_date: null,
      resolution: null,
      restored_by: null,
      restored_at: null,
      restoration_reason: null,
      created_at: "2026-01-05T00:00:00.000Z",
    },
  ]);
  await assert.rejects(
    () =>
      recordAction(asClient(fake), { caseId: "case-1", actionType: "suspension", decidedBy: "user-officer-1", suspensionStartDate: "2026-02-01" }),
    /already has an active/
  );
});

test("recordAction allows a new suspension once the prior one has been restored", async () => {
  const fake = seed("action_decided");
  fake.__db.set("disciplinary_actions", [
    {
      id: "action-1",
      case_id: "case-1",
      action_type: "suspension",
      decided_by: "user-officer-1",
      decided_at: "2026-01-05T00:00:00.000Z",
      suspension_start_date: "2026-01-05",
      suspension_end_date: "2026-01-20",
      resolution: null,
      restored_by: "user-officer-1",
      restored_at: "2026-01-20T00:00:00.000Z",
      restoration_reason: "Cleared.",
      created_at: "2026-01-05T00:00:00.000Z",
    },
  ]);
  const action = await recordAction(asClient(fake), {
    caseId: "case-1",
    actionType: "suspension",
    decidedBy: "user-officer-1",
    suspensionStartDate: "2026-03-01",
  });
  assert.equal(action.actionType, "suspension");
});

test("recordAction refuses a second dismissal on the same case", async () => {
  const fake = seed("action_decided");
  fake.__db.set("disciplinary_actions", [
    {
      id: "action-1",
      case_id: "case-1",
      action_type: "dismissal",
      decided_by: "user-officer-1",
      decided_at: "2026-01-05T00:00:00.000Z",
      suspension_start_date: null,
      suspension_end_date: null,
      resolution: null,
      restored_by: null,
      restored_at: null,
      restoration_reason: null,
      created_at: "2026-01-05T00:00:00.000Z",
    },
  ]);
  await assert.rejects(
    () => recordAction(asClient(fake), { caseId: "case-1", actionType: "dismissal", decidedBy: "user-officer-1" }),
    /already recorded a dismissal/
  );
});
