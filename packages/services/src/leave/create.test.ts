import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createLeaveRequest } from "./create";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    members: [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001" }],
    leave_requests: [],
  });
}

test("createLeaveRequest inserts a pending request and resolves the member's name", async () => {
  const fake = seed();
  const result = await createLeaveRequest(asClient(fake), {
    memberId: "member-1",
    leaveType: "planned",
    reason: "Family event out of town",
    startDate: "2026-03-01",
    endDate: "2026-03-03",
  });
  assert.equal(result.memberName, "Asha Mwakalinga");
  assert.equal(result.status, "pending");
});

test("createLeaveRequest rejects a blank reason", async () => {
  const fake = seed();
  await assert.rejects(() =>
    createLeaveRequest(asClient(fake), { memberId: "member-1", leaveType: "planned", reason: "   ", startDate: "2026-03-01", endDate: "2026-03-03" })
  );
});

test("createLeaveRequest rejects an end date before the start date", async () => {
  const fake = seed();
  await assert.rejects(() =>
    createLeaveRequest(asClient(fake), {
      memberId: "member-1",
      leaveType: "planned",
      reason: "Trip",
      startDate: "2026-03-05",
      endDate: "2026-03-01",
    })
  );
});
