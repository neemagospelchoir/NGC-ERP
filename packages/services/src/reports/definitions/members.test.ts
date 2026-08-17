import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runMembersReport } from "./members";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const MEMBERS: FakeRow[] = [
  {
    id: "member-asha",
    member_number: "NGC-2026-0001",
    first_name: "Asha",
    last_name: "Mwakalinga",
    preferred_name: null,
    photo_url: null,
    membership_status: "active",
    primary_department_id: "dept-sopranos",
    family_id: null,
    joined_at: "2026-02-10",
  },
  {
    id: "member-baraka",
    member_number: "NGC-2026-0002",
    first_name: "Baraka",
    last_name: "Mushi",
    preferred_name: null,
    photo_url: null,
    membership_status: "active",
    primary_department_id: "dept-altos",
    family_id: null,
    joined_at: "2025-06-01", // outside the report's period
  },
];
const DEPARTMENTS: FakeRow[] = [{ id: "dept-sopranos", name: "Sopranos" }];

test("runMembersReport returns only members who joined within the resolved period", async () => {
  const fake = createFakeSupabaseClient({ members: MEMBERS, departments: DEPARTMENTS, families: [] });
  const result = await runMembersReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });

  assert.equal(result.reportKey, "members");
  assert.deepEqual(result.period, { from: "2026-02-01", to: "2026-02-28" });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.memberNumber, "NGC-2026-0001");
  assert.equal(result.rows[0]?.department, "Sopranos");
});

test("runMembersReport narrows further by department", async () => {
  const fake = createFakeSupabaseClient({ members: MEMBERS, departments: DEPARTMENTS, families: [] });
  const result = await runMembersReport(asClient(fake), {
    period: { period: "yearly", year: 2025 },
    departmentId: "dept-sopranos",
  });
  assert.equal(result.rows.length, 0, "Asha joined in 2026, not 2025, so the department filter alone shouldn't surface her");
});
