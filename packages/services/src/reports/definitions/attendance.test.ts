import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runAttendanceReport } from "./attendance";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    departments: [],
    attendance_sessions: [
      { id: "session-1", session_type: "rehearsal", title: "Week 1", department_id: null, event_id: null, session_date: "2026-02-05" },
      { id: "session-2", session_type: "rehearsal", title: "Week 2", department_id: null, event_id: null, session_date: "2026-02-12" },
      { id: "session-outside", session_type: "rehearsal", title: "Prior month", department_id: null, event_id: null, session_date: "2026-01-29" },
    ],
    members: [
      { id: "member-asha", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001", primary_department_id: null, membership_status: "active" },
      { id: "member-baraka", first_name: "Baraka", last_name: "Kessy", member_number: "NGC-2026-0002", primary_department_id: null, membership_status: "active" },
    ] as FakeRow[],
    attendance: [
      { id: "att-1", session_id: "session-1", member_id: "member-asha", status_code: "present", notes: null, recorded_via: "manual", created_at: "2026-02-05T00:00:00.000Z" },
      { id: "att-2", session_id: "session-1", member_id: "member-baraka", status_code: "absent", notes: null, recorded_via: "manual", created_at: "2026-02-05T00:00:00.000Z" },
      { id: "att-3", session_id: "session-2", member_id: "member-asha", status_code: "present", notes: null, recorded_via: "manual", created_at: "2026-02-12T00:00:00.000Z" },
      // member-baraka is never marked for session-2 — should not count toward their denominator.
    ],
    lookup_values: [
      { id: "lv-1", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } },
      { id: "lv-2", category: "attendance_status", code: "absent", label: "Absent", sort_order: 2, is_active: true, metadata: { counts_as_present: false } },
    ],
  });
}

test("runAttendanceReport tallies presence per member across only the sessions in the resolved period", async () => {
  const fake = seed();
  const result = await runAttendanceReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });

  assert.deepEqual(result.period, { from: "2026-02-01", to: "2026-02-28" });

  const asha = result.rows.find((r) => r.memberNumber === "NGC-2026-0001");
  assert.equal(asha?.sessionsRecorded, 2);
  assert.equal(asha?.sessionsPresent, 2);
  assert.equal(asha?.attendancePercentage, 100);

  const baraka = result.rows.find((r) => r.memberNumber === "NGC-2026-0002");
  assert.equal(baraka?.sessionsRecorded, 1, "only session-1 was ever marked for baraka; the never-marked session-2 must not inflate the denominator");
  assert.equal(baraka?.sessionsPresent, 0);
  assert.equal(baraka?.attendancePercentage, 0);
});

test("runAttendanceReport excludes a member with no recorded attendance in the period at all", async () => {
  const fake = createFakeSupabaseClient({
    attendance_sessions: [{ id: "session-1", session_type: "rehearsal", title: "Week 1", department_id: null, event_id: null, session_date: "2026-02-05" }],
    members: [{ id: "member-asha", first_name: "Asha", last_name: "Mwakalinga", member_number: "NGC-2026-0001", primary_department_id: null, membership_status: "active" }],
    attendance: [],
    lookup_values: [{ id: "lv-1", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } }],
    departments: [],
  });
  const result = await runAttendanceReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.equal(result.rows.length, 0, "a session with zero marked attendance should produce zero tallied members, not a member row with null%/0 counts");
});
