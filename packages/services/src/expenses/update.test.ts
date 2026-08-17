import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updateExpenseRequest } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "draft"): FakeRow[] {
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

test("updateExpenseRequest updates the amount while still a draft", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed() });
  const request = await updateExpenseRequest(asClient(fake), "expense-1", { amount: 75000 });
  assert.equal(request.amount, 75000);
});

test("updateExpenseRequest refuses a negative amount", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed() });
  await assert.rejects(() => updateExpenseRequest(asClient(fake), "expense-1", { amount: -5 }), ServiceError);
});

test("updateExpenseRequest refuses to edit a request that is no longer a draft", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed("pending_approval") });
  await assert.rejects(() => updateExpenseRequest(asClient(fake), "expense-1", { amount: 1000 }), ServiceError);
});

test("updateExpenseRequest can set a supporting document reference", async () => {
  const fake = createFakeSupabaseClient({ expense_requests: seed() });
  const request = await updateExpenseRequest(asClient(fake), "expense-1", { supportingDocumentId: "doc-1" });
  assert.equal(request.supportingDocumentId, "doc-1");
});
