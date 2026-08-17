import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { cancelProcurementRequest } from "./cancel";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status: string): FakeRow[] {
  return [
    {
      id: "proc-1",
      expense_request_id: "expense-1",
      vendor_id: null,
      description: "PA speakers",
      status,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("cancelProcurementRequest cancels a pending request", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("pending") });
  const request = await cancelProcurementRequest(asClient(fake), "proc-1");
  assert.equal(request.status, "cancelled");
});

test("cancelProcurementRequest cancels a vendor_selected request", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("vendor_selected") });
  const request = await cancelProcurementRequest(asClient(fake), "proc-1");
  assert.equal(request.status, "cancelled");
});

test("cancelProcurementRequest refuses to cancel an already-purchased request", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("purchased") });
  await assert.rejects(() => cancelProcurementRequest(asClient(fake), "proc-1"), ServiceError);
});

test("cancelProcurementRequest refuses to re-cancel", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("cancelled") });
  await assert.rejects(() => cancelProcurementRequest(asClient(fake), "proc-1"), ServiceError);
});
