import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { selectVendor } from "./vendor";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "pending"): FakeRow[] {
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

test("selectVendor moves a pending request to vendor_selected", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed() });
  const request = await selectVendor(asClient(fake), "proc-1", "vendor-1");
  assert.equal(request.status, "vendor_selected");
  assert.equal(request.vendorId, "vendor-1");
});

test("selectVendor requires a vendor id", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed() });
  await assert.rejects(() => selectVendor(asClient(fake), "proc-1", ""), ServiceError);
});

test("selectVendor refuses a request that is no longer pending", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("purchased") });
  await assert.rejects(() => selectVendor(asClient(fake), "proc-1", "vendor-1"), ServiceError);
});
