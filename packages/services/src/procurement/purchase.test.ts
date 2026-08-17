import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { recordPurchase } from "./purchase";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "vendor_selected"): FakeRow[] {
  return [
    {
      id: "proc-1",
      expense_request_id: "expense-1",
      vendor_id: "vendor-1",
      description: "PA speakers",
      status,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("recordPurchase creates a purchase order and moves the request to purchased", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed(), purchase_orders: [] as FakeRow[] });
  const order = await recordPurchase(asClient(fake), "proc-1", { vendorId: "vendor-1", amount: 250000 });
  assert.equal(order.paymentStatus, "unpaid");
  assert.equal(order.amount, 250000);
  assert.equal(order.currency, "TZS");

  const request = (fake.__db.get("procurement_requests") ?? []).find((r) => r.id === "proc-1");
  assert.equal(request?.status, "purchased");
});

test("recordPurchase requires a vendor and a non-negative amount", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed(), purchase_orders: [] as FakeRow[] });
  await assert.rejects(() => recordPurchase(asClient(fake), "proc-1", { vendorId: "", amount: 100 }), ServiceError);
  await assert.rejects(() => recordPurchase(asClient(fake), "proc-1", { vendorId: "vendor-1", amount: -5 }), ServiceError);
});

test("recordPurchase refuses a request with no vendor selected yet", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("pending"), purchase_orders: [] as FakeRow[] });
  await assert.rejects(() => recordPurchase(asClient(fake), "proc-1", { vendorId: "vendor-1", amount: 100 }), ServiceError);
});

test("recordPurchase refuses a request that already has a purchase recorded", async () => {
  const fake = createFakeSupabaseClient({ procurement_requests: seed("purchased"), purchase_orders: [] as FakeRow[] });
  await assert.rejects(() => recordPurchase(asClient(fake), "proc-1", { vendorId: "vendor-1", amount: 100 }), ServiceError);
});
