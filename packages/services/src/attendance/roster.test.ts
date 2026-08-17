import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getSessionRoster } from "./roster";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    attendance_sessions: [
      { id: "session-dept", department_id: "dept-1" },
      { id: "session-choir", department_id: null },
    ],
    members: [
      { id: "member-1", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001", primary_department_id: "dept-1", membership_status: "active" },
      { id: "member-2", first_name: "Baraka", last_name: "Kessy", member_number: "NGC-2026-0002", primary_department_id: "dept-2", membership_status: "active" },
      { id: "member-3", first_name: "Zawadi", last_name: "Juma", member_number: "NGC-2026-0003", primary_department_id: "dept-1", membership_status: "exited" },
    ],
    attendance: [
      { id: "att-1", session_id: "session-dept", member_id: "member-1", status_code: "present", notes: null, recorded_via: "manual", created_at: "2026-01-01T00:00:00.000Z" },
    ],
  });
}

test("getSessionRoster scopes to the session's department and excludes exited members", async () => {
  const fake = seed();
  const roster = await getSessionRoster(asClient(fake), "session-dept");
  assert.deepEqual(
    roster.map((r) => r.memberId),
    ["member-1"]
  );
  assert.equal(roster[0]?.statusCode, "present");
});

test("getSessionRoster includes every non-exited member for a whole-choir session", async () => {
  const fake = seed();
  const roster = await getSessionRoster(asClient(fake), "session-choir");
  assert.deepEqual(
    roster.map((r) => r.memberId).sort(),
    ["member-1", "member-2"]
  );
});

test("getSessionRoster lists a not-yet-marked member with a null status", async () => {
  const fake = seed();
  const roster = await getSessionRoster(asClient(fake), "session-choir");
  const unmarked = roster.find((r) => r.memberId === "member-2");
  assert.equal(unmarked?.statusCode, null);
});

test("getSessionRoster throws for an unknown session", async () => {
  const fake = seed();
  await assert.rejects(() => getSessionRoster(asClient(fake), "missing"));
});
