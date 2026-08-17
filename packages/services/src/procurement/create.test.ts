import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createProcurementRequest } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seedExpense(status = "approved"): FakeRow[] {
  return [
    {
      id: "expense-1",
      request_number: "EXP-2026-0001",
      requested_by: "user-1",
      description: "Transport",
      amount: 50000,
      currency: "TZS",
      category: null,
      department_id: null,
      event_id: null,
      supporting_document_id: null,
      status,
      paid_at: null,
      payment_reference: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("createProcurementRequest creates a pending request for an approved expense", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seedExpense(), procurement_requests: [] as FakeRow[] });
  const request = await createProcurementRequest(asClient(fake), { expenseRequestId: "expense-1", description: "PA speakers" });
  assert.equal(request.status, "pending");
  assert.equal(request.expenseRequestId, "expense-1");
});

test("createProcurementRequest refuses an expense request that isn't approved", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seedExpense("pending_approval"), procurement_requests: [] as FakeRow[] });
  await assert.rejects(
    () => createProcurementRequest(asClient(fake), { expenseRequestId: "expense-1", description: "PA speakers" }),
    ServiceError
  );
});

test("createProcurementRequest requires a description", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seedExpense(), procurement_requests: [] as FakeRow[] });
  await assert.rejects(
    () => createProcurementRequest(asClient(fake), { expenseRequestId: "expense-1", description: "  " }),
    ServiceError
  );
});
