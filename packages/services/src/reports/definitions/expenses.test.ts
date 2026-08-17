import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runExpensesReport } from "./expenses";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const REQUESTS: FakeRow[] = [
  { id: "exp-1", request_number: "EXP-2026-0001", requested_by: "user-1", description: "Transport", amount: 15000, currency: "TZS", status: "approved", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "exp-2", request_number: "EXP-2026-0002", requested_by: "user-2", description: "Refreshments", amount: 8000, currency: "TZS", status: "draft", created_at: "2026-05-01T00:00:00.000Z" },
];

test("runExpensesReport scopes by the resolved period", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: REQUESTS });
  const result = await runExpensesReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.deepEqual(result.rows.map((r) => r.requestNumber), ["EXP-2026-0001"]);
});

test("runExpensesReport narrows further by status", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: REQUESTS });
  const result = await runExpensesReport(asClient(fake), { period: { period: "yearly", year: 2026 }, status: "draft" });
  assert.deepEqual(result.rows.map((r) => r.requestNumber), ["EXP-2026-0002"]);
});
