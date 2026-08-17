import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listAssetCategories, listAssets, getAsset, listAssignmentsForTarget } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const CATEGORIES: FakeRow[] = [
  { id: "cat-audio", name: "Audio Equipment", description: null, is_active: true },
  { id: "cat-old", name: "Retired Category", description: null, is_active: false },
];

const ASSETS: FakeRow[] = [
  { id: "asset-1", asset_tag: "AST-2026-0001", category_id: "cat-audio", availability_status: "available", photo_urls: [], created_at: "2026-02-05T00:00:00.000Z" },
  { id: "asset-2", asset_tag: "AST-2026-0002", category_id: "cat-audio", availability_status: "assigned", photo_urls: [], created_at: "2026-05-01T00:00:00.000Z" },
];

test("listAssetCategories excludes inactive categories by default", async () => {
  const fake = createFakeSupabaseClient({ asset_categories: CATEGORIES });
  const result = await listAssetCategories(asClient(fake));
  assert.deepEqual(result.map((c) => c.name), ["Audio Equipment"]);
});

test("listAssets filters by category and availability status", async () => {
  const fake = createFakeSupabaseClient({ assets: ASSETS });
  const available = await listAssets(asClient(fake), { categoryId: "cat-audio", availabilityStatus: "available" });
  assert.equal(available.length, 1);
  assert.equal(available[0]?.assetTag, "AST-2026-0001");
});

test("listAssets filters by a created_at range — added for Phase 13.2's Asset/Inventory Report", async () => {
  const fake = createFakeSupabaseClient({ assets: ASSETS });
  const result = await listAssets(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(result.map((a) => a.assetTag), ["AST-2026-0001"]);
});

test("getAsset returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ assets: ASSETS });
  const result = await getAsset(asClient(fake), "does-not-exist");
  assert.equal(result, null);
});

test("listAssignmentsForTarget scopes to the given target type and id", async () => {
  const fake = createFakeSupabaseClient({
    asset_assignments: [
      { id: "a1", asset_id: "asset-1", target_type: "event", target_id: "event-1", assigned_at: "2026-01-01T00:00:00.000Z" },
      { id: "a2", asset_id: "asset-2", target_type: "member", target_id: "member-1", assigned_at: "2026-01-02T00:00:00.000Z" },
    ],
  });
  const result = await listAssignmentsForTarget(asClient(fake), "event", "event-1");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "a1");
});
