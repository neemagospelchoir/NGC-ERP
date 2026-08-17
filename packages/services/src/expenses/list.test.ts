import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listExpenseRequests } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const REQUESTS: FakeRow[] = [
  {
    id: "exp-1",
    request_number: "EXP-2026-0001",
    requested_by: "user-1",
    description: "Transport",
    amount: 15000,
    currency: "TZS",
    category: "transport",
    department_id: null,
    event_id: null,
    supporting_document_id: null,
    status: "approved",
    paid_at: null,
    payment_reference: null,
    created_at: "2026-02-05T00:00:00.000Z",
    updated_at: "2026-02-05T00:00:00.000Z",
  },
  {
    id: "exp-2",
    request_number: "EXP-2026-0002",
    requested_by: "user-2",
    description: "Refreshments",
    amount: 8000,
    currency: "TZS",
    category: "supplies",
    department_id: null,
    event_id: null,
    supporting_document_id: null,
    status: "draft",
    paid_at: null,
    payment_reference: null,
    created_at: "2026-05-01T00:00:00.000Z", // outside the period
    updated_at: "2026-05-01T00:00:00.000Z",
  },
];

test("listExpenseRequests filters by a created_at range — added for Phase 13.2's Expense Report", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: REQUESTS });
  const result = await listExpenseRequests(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(result.map((r) => r.requestNumber), ["EXP-2026-0001"]);
});

test("listExpenseRequests combines a created_at range with a status filter", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: REQUESTS });
  const result = await listExpenseRequests(asClient(fake), { status: "draft", createdFrom: "2026-01-01", createdTo: "2026-12-31" });
  assert.deepEqual(result.map((r) => r.requestNumber), ["EXP-2026-0002"]);
});
