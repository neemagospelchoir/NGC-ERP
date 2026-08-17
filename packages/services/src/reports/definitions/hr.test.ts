import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runHrReport } from "./hr";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const MEMBERS: FakeRow[] = [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001" }];
const LEAVE_REQUESTS: FakeRow[] = [
  {
    id: "leave-1",
    member_id: "member-1",
    leave_type: "planned",
    reason: "Trip",
    start_date: "2026-02-01",
    end_date: "2026-02-03",
    status: "pending",
    approved_by: null,
    approved_at: null,
    approver_comment: null,
    created_at: "2026-02-05T00:00:00.000Z",
  },
  {
    id: "leave-2",
    member_id: "member-1",
    leave_type: "emergency",
    reason: "Illness",
    start_date: "2026-05-01",
    end_date: "2026-05-02",
    status: "approved",
    approved_by: "user-hr",
    approved_at: "2026-05-01T00:00:00.000Z",
    approver_comment: "Get well soon",
    created_at: "2026-05-01T00:00:00.000Z",
  },
];

test("runHrReport scopes by created_at within the resolved period and resolves the member name", async () => {
  const fake = createFakeSupabaseClient({ leave_requests: LEAVE_REQUESTS, members: MEMBERS });
  const result = await runHrReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.deepEqual(result.rows.map((r) => r.startDate), ["2026-02-01"]);
  assert.equal(result.rows[0]?.memberName, "Asha Mwakalinga");
});

test("runHrReport narrows by status within the same period query", async () => {
  const fake = createFakeSupabaseClient({
    leave_requests: [
      { ...LEAVE_REQUESTS[0], status: "pending" },
      { ...LEAVE_REQUESTS[0], id: "leave-3", status: "approved" },
    ],
    members: MEMBERS,
  });
  const result = await runHrReport(asClient(fake), {
    period: { period: "monthly", year: 2026, month: 2 },
    status: "approved",
  });
  assert.deepEqual(result.rows.map((r) => r.status), ["approved"]);
});
