import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getLeaveRequest, listLeaveRequests } from "./list";
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
    leave_requests: [
      {
        id: "leave-1",
        member_id: "member-1",
        leave_type: "planned",
        reason: "Trip",
        start_date: "2026-03-01",
        end_date: "2026-03-03",
        status: "pending",
        approved_by: null,
        approved_at: null,
        approver_comment: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "leave-2",
        member_id: "member-2",
        leave_type: "emergency",
        reason: "Illness",
        start_date: "2026-02-01",
        end_date: "2026-02-02",
        status: "approved",
        approved_by: "user-hr",
        approved_at: "2026-02-01T00:00:00.000Z",
        approver_comment: "Get well soon",
        created_at: "2026-01-15T00:00:00.000Z",
      },
    ],
  });
}

test("listLeaveRequests resolves member names for every row", async () => {
  const fake = seed();
  const rows = await listLeaveRequests(asClient(fake));
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.memberName !== "(unknown member)"));
});

test("listLeaveRequests filters by memberId (a member viewing only their own requests)", async () => {
  const fake = seed();
  const rows = await listLeaveRequests(asClient(fake), { memberId: "member-1" });
  assert.deepEqual(rows.map((r) => r.id), ["leave-1"]);
});

test("listLeaveRequests filters by status", async () => {
  const fake = seed();
  const rows = await listLeaveRequests(asClient(fake), { status: "approved" });
  assert.deepEqual(rows.map((r) => r.id), ["leave-2"]);
});

test("listLeaveRequests filters by a created_at range — added for Phase 13.2's HR Report", async () => {
  const fake = seed();
  const rows = await listLeaveRequests(asClient(fake), { createdFrom: "2026-01-10", createdTo: "2026-01-31" });
  assert.deepEqual(rows.map((r) => r.id), ["leave-2"]);
});

test("getLeaveRequest returns null for an unknown id", async () => {
  const fake = seed();
  const row = await getLeaveRequest(asClient(fake), "missing");
  assert.equal(row, null);
});
