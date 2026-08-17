import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createAssetForPurchaseOrder } from "./asset";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seedOrder(createdAssetId: string | null = null): FakeRow[] {
  return [
    {
      id: "order-1",
      procurement_request_id: "proc-1",
      vendor_id: "vendor-1",
      amount: 250000,
      currency: "TZS",
      purchased_at: "2026-01-05T00:00:00.000Z",
      paid_at: null,
      payment_status: "unpaid",
      created_asset_id: createdAssetId,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("createAssetForPurchaseOrder creates an asset via inventory.createAsset and links it back", async () => {
  const fake = createFakeSupabaseClient(
    {
      purchase_orders: seedOrder(),
      assets: [] as FakeRow[],
      system_settings: [{ setting_key: "id_format.asset_tag", value: "AST-{year}-{sequence}" }],
    },
    { rpcStubs: { next_formatted_id: async () => ({ data: "AST-2026-0001", error: null }) } }
  );
  const { purchaseOrder, asset } = await createAssetForPurchaseOrder(asClient(fake), "order-1", {
    categoryId: "cat-audio",
    name: "PA Speaker",
  });
  assert.equal(asset.assetTag, "AST-2026-0001");
  assert.equal(purchaseOrder.createdAssetId, asset.id);
});

test("createAssetForPurchaseOrder refuses to run twice for the same purchase order", async () => {
  const fake = createFakeSupabaseClient({
    purchase_orders: seedOrder("asset-existing"),
    assets: [] as FakeRow[],
    system_settings: [] as FakeRow[],
  });
  await assert.rejects(
    () => createAssetForPurchaseOrder(asClient(fake), "order-1", { categoryId: "cat-audio", name: "PA Speaker" }),
    ServiceError
  );
});
