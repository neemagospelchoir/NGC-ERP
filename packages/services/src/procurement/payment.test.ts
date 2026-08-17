import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { recordPayment } from "./payment";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(purchasedAt: string | null = "2026-01-05T00:00:00.000Z"): FakeRow[] {
  return [
    {
      id: "order-1",
      procurement_request_id: "proc-1",
      vendor_id: "vendor-1",
      amount: 250000,
      currency: "TZS",
      purchased_at: purchasedAt,
      paid_at: null,
      payment_status: "unpaid",
      created_asset_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("recordPayment marks a purchase order paid", async () => {
  const fake = createFakeSupabaseClient({ purchase_orders: seed() });
  const order = await recordPayment(asClient(fake), "order-1", { paymentStatus: "paid" });
  assert.equal(order.paymentStatus, "paid");
  assert.ok(order.paidAt);
});

test("recordPayment refuses a purchase order with no recorded purchase", async () => {
  const fake = createFakeSupabaseClient({ purchase_orders: seed(null) });
  await assert.rejects(() => recordPayment(asClient(fake), "order-1", { paymentStatus: "paid" }), ServiceError);
});
