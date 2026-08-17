import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runDisciplineReport } from "./discipline";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const MEMBERS: FakeRow[] = [{ id: "member-1", first_name: "Amina", last_name: "Njau", member_number: "NGC-2026-0050" }];
const CASES: FakeRow[] = [
  { id: "case-1", case_number: "DISC-2026-0001", member_id: "member-1", category: "conduct", status: "open", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "case-2", case_number: "DISC-2026-0002", member_id: "member-1", category: "conduct", status: "open", created_at: "2026-05-01T00:00:00.000Z" },
];

/**
 * These unit tests call `runDisciplineReport` directly with a fake client
 * that has no RLS at all — by design (this suite tests query-shape/period-
 * scoping, not the RLS boundary itself, same as every other definition's
 * test file). The actual confidentiality boundary (`disciplinary_cases_
 * select_discipline_only`, 0007) is real Postgres RLS, verified against a
 * real database elsewhere, plus the reports web UI's own explicit
 * permission check before ever calling this function at all (see
 * discipline.ts's own doc comment and docs/PHASE_13_2.md §2).
 */
test("runDisciplineReport scopes by created_at within the resolved period and resolves the member name", async () => {
  const fake = createFakeSupabaseClient({ disciplinary_cases: CASES, members: MEMBERS });
  const result = await runDisciplineReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.deepEqual(result.rows.map((r) => r.caseNumber), ["DISC-2026-0001"]);
  assert.equal(result.rows[0]?.memberName, "Amina Njau");
});
