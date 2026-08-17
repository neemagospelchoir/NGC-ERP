import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { closeExpenseRequest, markExpensePaid } from "./lifecycle";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status: string): FakeRow[] {
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

test("markExpensePaid marks an approved request paid with a payment reference", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed("approved") });
  const request = await markExpensePaid(asClient(fake), "expense-1", "MPESA-12345");
  assert.equal(request.status, "paid");
  assert.equal(request.paymentReference, "MPESA-12345");
  assert.ok(request.paidAt);
});

test("markExpensePaid refuses a request that isn't approved", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed("pending_approval") });
  await assert.rejects(() => markExpensePaid(asClient(fake), "expense-1"), ServiceError);
});

test("closeExpenseRequest closes a paid request", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed("paid") });
  const request = await closeExpenseRequest(asClient(fake), "expense-1");
  assert.equal(request.status, "closed");
});

test("closeExpenseRequest refuses a request that isn't paid", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed("approved") });
  await assert.rejects(() => closeExpenseRequest(asClient(fake), "expense-1"), ServiceError);
});
