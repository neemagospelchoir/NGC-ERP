import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createCampaign } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createCampaign defaults to active status and TZS currency", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: [] as FakeRow[] });
  const campaign = await createCampaign(asClient(fake), { name: "Christmas Fund", targetAmount: 1000000 });
  assert.equal(campaign.status, "active");
  assert.equal(campaign.currency, "TZS");
  assert.equal(campaign.targetAmount, 1000000);
});

test("createCampaign accepts an explicit draft status", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: [] as FakeRow[] });
  const campaign = await createCampaign(asClient(fake), { name: "Building Fund", status: "draft" });
  assert.equal(campaign.status, "draft");
});

test("createCampaign requires a name", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: [] as FakeRow[] });
  await assert.rejects(() => createCampaign(asClient(fake), { name: "  " }), ServiceError);
});

test("createCampaign refuses a negative target amount", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: [] as FakeRow[] });
  await assert.rejects(() => createCampaign(asClient(fake), { name: "Fund", targetAmount: -1 }), ServiceError);
});
