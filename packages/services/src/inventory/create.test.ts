import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createAsset } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createAsset reads the configured format and generates an asset tag via next_formatted_id", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [{ setting_key: "id_format.asset_tag", value: "AST-{year}-{sequence}" }], assets: [] },
    { rpcStubs: { next_formatted_id: async () => ({ data: "AST-2026-0001", error: null }) } }
  );
  const asset = await createAsset(asClient(fake), { categoryId: "cat-audio", name: "PA Speaker" });
  assert.equal(asset.assetTag, "AST-2026-0001");
  assert.equal(asset.condition, "good"); // default
  assert.equal(asset.currency, "TZS"); // default
});

test("createAsset falls back to a default format if system_settings is missing the row", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [], assets: [] },
    {
      rpcStubs: {
        next_formatted_id: async (args) => {
          assert.equal(args.p_format, "AST-{year}-{sequence}");
          return { data: "AST-2026-0002", error: null };
        },
      },
    }
  );
  await createAsset(asClient(fake), { categoryId: "cat-audio", name: "Mixer" });
});

test("createAsset requires a name and a category", async () => {
  const fake = createFakeSupabaseClient({ system_settings: [] as FakeRow[], assets: [] });
  await assert.rejects(() => createAsset(asClient(fake), { categoryId: "cat-audio", name: "  " }), ServiceError);
  await assert.rejects(() => createAsset(asClient(fake), { categoryId: "", name: "Camera" }), ServiceError);
});
