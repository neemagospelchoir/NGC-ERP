import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listAttendanceStatuses } from "./statuses";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("listAttendanceStatuses reads only active attendance_status lookup values, with counts_as_present", async () => {
  const fake = createFakeSupabaseClient({
    lookup_values: [
      { id: "lv-1", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } },
      { id: "lv-2", category: "attendance_status", code: "absent", label: "Absent", sort_order: 2, is_active: true, metadata: { counts_as_present: false } },
      { id: "lv-3", category: "attendance_status", code: "retired_code", label: "Retired", sort_order: 3, is_active: false, metadata: {} },
      { id: "lv-4", category: "expense_category", code: "travel", label: "Travel", sort_order: 1, is_active: true, metadata: {} },
    ],
  });

  const statuses = await listAttendanceStatuses(asClient(fake));
  assert.deepEqual(
    statuses.map((s) => s.code),
    ["present", "absent"]
  );
  assert.equal(statuses[0]?.countsAsPresent, true);
  assert.equal(statuses[1]?.countsAsPresent, false);
});
