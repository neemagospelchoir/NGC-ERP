import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getMemberAttendanceSummary } from "./summary";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("getMemberAttendanceSummary maps an existing view row", async () => {
  const fake = createFakeSupabaseClient({
    member_attendance_summary: [{ member_id: "member-1", sessions_present: 8, sessions_recorded: 10, attendance_percentage: 80 }],
  });
  const summary = await getMemberAttendanceSummary(asClient(fake), "member-1");
  assert.equal(summary.sessionsPresent, 8);
  assert.equal(summary.sessionsRecorded, 10);
  assert.equal(summary.attendancePercentage, 80);
});

test("getMemberAttendanceSummary returns a zeroed/null summary for a member with no recorded attendance", async () => {
  const fake = createFakeSupabaseClient({ member_attendance_summary: [] });
  const summary = await getMemberAttendanceSummary(asClient(fake), "member-1");
  assert.equal(summary.sessionsRecorded, 0);
  assert.equal(summary.attendancePercentage, null);
});
