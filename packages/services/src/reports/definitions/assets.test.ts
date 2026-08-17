import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runAssetsReport } from "./assets";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const CATEGORIES: FakeRow[] = [{ id: "cat-audio", name: "Audio Equipment", is_active: true }];
const ASSETS: FakeRow[] = [
  { id: "asset-1", asset_tag: "AST-2026-0001", category_id: "cat-audio", name: "Mixer", availability_status: "available", condition: "good", photo_urls: [], created_at: "2026-02-05T00:00:00.000Z" },
  { id: "asset-2", asset_tag: "AST-2026-0002", category_id: "cat-audio", name: "Speaker", availability_status: "available", condition: "good", photo_urls: [], created_at: "2026-05-01T00:00:00.000Z" },
];

test("runAssetsReport scopes by the resolved period and resolves category names", async () => {
  const fake = createFakeSupabaseClient({ assets: ASSETS, asset_categories: CATEGORIES });
  const result = await runAssetsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.deepEqual(result.rows.map((r) => r.assetTag), ["AST-2026-0001"]);
  assert.equal(result.rows[0]?.category, "Audio Equipment");
});
