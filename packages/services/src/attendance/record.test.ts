import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { recordAttendance } from "./record";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("recordAttendance inserts a new record when none exists yet", async () => {
  const fake = seed();
  await recordAttendance(asClient(fake), {
    sessionId: "session-1",
    memberId: "member-1",
    statusCode: "present",
    recordedBy: "user-hr",
  });
  const rows = fake.__db.get("attendance") ?? [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status_code, "present");
});

test("recordAttendance updates the existing record instead of duplicating it", async () => {
  const fake = seed();
  await recordAttendance(asClient(fake), { sessionId: "session-1", memberId: "member-1", statusCode: "present", recordedBy: "user-hr" });
  await recordAttendance(asClient(fake), { sessionId: "session-1", memberId: "member-1", statusCode: "late", recordedBy: "user-hr" });

  const rows = fake.__db.get("attendance") ?? [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status_code, "late");
});

test("recordAttendance rejects a blank status code", async () => {
  const fake = seed();
  await assert.rejects(() =>
    recordAttendance(asClient(fake), { sessionId: "session-1", memberId: "member-1", statusCode: "  ", recordedBy: "user-hr" })
  );
});

test("recordAttendance rejects a status code that isn't a real, active lookup_values entry", async () => {
  const fake = seed();
  await assert.rejects(() =>
    recordAttendance(asClient(fake), { sessionId: "session-1", memberId: "member-1", statusCode: "on_the_moon", recordedBy: "user-hr" })
  );
  await assert.rejects(
    () =>
      recordAttendance(asClient(fake), { sessionId: "session-1", memberId: "member-1", statusCode: "retired_code", recordedBy: "user-hr" }),
    /not a recognized attendance status/
  );
  assert.equal((fake.__db.get("attendance") ?? []).length, 0);
});

function seed() {
  return createFakeSupabaseClient({
    attendance: [],
    lookup_values: [
      { id: "lv-1", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } },
      { id: "lv-2", category: "attendance_status", code: "late", label: "Late", sort_order: 2, is_active: true, metadata: { counts_as_present: true } },
      { id: "lv-3", category: "attendance_status", code: "retired_code", label: "Retired", sort_order: 3, is_active: false, metadata: {} },
    ],
  });
}
