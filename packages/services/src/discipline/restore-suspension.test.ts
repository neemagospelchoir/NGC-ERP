import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { restoreSuspension } from "./restore-suspension";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(membershipStatus = "suspended") {
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
          status: "action_decided",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      disciplinary_actions: [
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
      ],
      members: [{ id: "member-1", first_name: "Amina", last_name: "Njau", member_number: "NGC-2026-0050", membership_status: membershipStatus }],
    },
    { rpcStubs: { apply_disciplinary_membership_status: async () => ({ data: null, error: null }) } }
  );
}

test("restoreSuspension sets restored_by/restored_at/restoration_reason and reactivates a currently-suspended member", async () => {
  const fake = seed("suspended");
  let seenArgs: Record<string, unknown> | undefined;
  const wrapped = { ...fake, rpc: async (fn: string, args: Record<string, unknown>) => { if (fn === "apply_disciplinary_membership_status") seenArgs = args; return { data: null, error: null }; } };

  const result = await restoreSuspension(asClient(wrapped as unknown as ReturnType<typeof createFakeSupabaseClient>), {
    actionId: "action-1",
    restoredBy: "user-officer-1",
    restorationReason: "Investigation cleared them.",
  });
  assert.equal(result.restorationReason, "Investigation cleared them.");
  assert.equal(seenArgs?.p_status, "active");
  assert.equal(seenArgs?.p_member_id, "member-1");
});

test("restoreSuspension does not touch membership_status if the member is no longer suspended", async () => {
  const fake = seed("exited");
  let called = false;
  const wrapped = { ...fake, rpc: async (fn: string) => { if (fn === "apply_disciplinary_membership_status") called = true; return { data: null, error: null }; } };

  await restoreSuspension(asClient(wrapped as unknown as ReturnType<typeof createFakeSupabaseClient>), {
    actionId: "action-1",
    restoredBy: "user-officer-1",
    restorationReason: "Investigation cleared them, but a later dismissal already superseded this.",
  });
  assert.equal(called, false);
});

test("restoreSuspension rejects a blank reason", async () => {
  const fake = seed();
  await assert.rejects(() => restoreSuspension(asClient(fake), { actionId: "action-1", restoredBy: "user-officer-1", restorationReason: "  " }));
});

test("restoreSuspension refuses to restore an already-restored action", async () => {
  const fake = seed();
  await restoreSuspension(asClient(fake), { actionId: "action-1", restoredBy: "user-officer-1", restorationReason: "First restoration." });
  await assert.rejects(() =>
    restoreSuspension(asClient(fake), { actionId: "action-1", restoredBy: "user-officer-1", restorationReason: "Second attempt." })
  );
});

test("restoreSuspension refuses a non-suspension action", async () => {
  const fake = seed();
  fake.__db.set("disciplinary_actions", [
    { id: "action-2", case_id: "case-1", action_type: "warning", decided_by: "user-officer-1", decided_at: "2026-01-05T00:00:00.000Z", suspension_start_date: null, suspension_end_date: null, resolution: null, restored_by: null, restored_at: null, restoration_reason: null, created_at: "2026-01-05T00:00:00.000Z" },
  ]);
  await assert.rejects(() =>
    restoreSuspension(asClient(fake), { actionId: "action-2", restoredBy: "user-officer-1", restorationReason: "N/A" })
  );
});
