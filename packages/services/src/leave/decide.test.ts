import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { decideLeaveRequest } from "./decide";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "pending") {
  return createFakeSupabaseClient({
    members: [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001" }],
    leave_requests: [
      {
        id: "leave-1",
        member_id: "member-1",
        leave_type: "planned",
        reason: "Trip",
        start_date: "2026-03-01",
        end_date: "2026-03-03",
        status,
        approved_by: null,
        approved_at: null,
        approver_comment: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
}

test("decideLeaveRequest approves a pending request and records the approver/comment", async () => {
  const fake = seed();
  const result = await decideLeaveRequest(asClient(fake), "leave-1", { approverId: "user-hr", decision: "approved", comment: "Enjoy" });
  assert.equal(result.status, "approved");
  assert.equal(result.approvedBy, "user-hr");
  assert.equal(result.approverComment, "Enjoy");
});

test("decideLeaveRequest rejects a request with no comment (comment is optional)", async () => {
  const fake = seed();
  const result = await decideLeaveRequest(asClient(fake), "leave-1", { approverId: "user-hr", decision: "rejected" });
  assert.equal(result.status, "rejected");
  assert.equal(result.approverComment, null);
});

test("decideLeaveRequest refuses to re-decide an already-decided request", async () => {
  const fake = seed("approved");
  await assert.rejects(() => decideLeaveRequest(asClient(fake), "leave-1", { approverId: "user-hr", decision: "rejected" }));
});
