import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { setCampaignStatus, updateCampaign } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "active"): FakeRow[] {
  return [
    {
      id: "campaign-1",
      name: "Christmas Fund",
      description: null,
      target_amount: 1000000,
      currency: "TZS",
      deadline: null,
      status,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("updateCampaign updates the target amount", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seed() });
  const campaign = await updateCampaign(asClient(fake), "campaign-1", { targetAmount: 2000000 });
  assert.equal(campaign.targetAmount, 2000000);
});

test("updateCampaign refuses a negative target amount", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seed() });
  await assert.rejects(() => updateCampaign(asClient(fake), "campaign-1", { targetAmount: -5 }), ServiceError);
});

test("updateCampaign refuses to edit a closed campaign", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seed("closed") });
  await assert.rejects(() => updateCampaign(asClient(fake), "campaign-1", { targetAmount: 500 }), ServiceError);
});

test("setCampaignStatus allows active -> closed", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seed("active") });
  const campaign = await setCampaignStatus(asClient(fake), "campaign-1", "closed");
  assert.equal(campaign.status, "closed");
});

test("setCampaignStatus refuses closed -> active", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seed("closed") });
  await assert.rejects(() => setCampaignStatus(asClient(fake), "campaign-1", "active"), ServiceError);
});

// Security-review regression: `setCampaignStatus` used to accept a
// caller-supplied "current status" instead of re-reading the row, letting
// a stale/forged `from` value smuggle through an otherwise-blocked
// transition. This asserts the DB's own status is authoritative even when
// the actual row is already terminal.
test("setCampaignStatus re-reads the campaign's real status rather than trusting a stale caller assumption", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seed("cancelled") });
  await assert.rejects(() => setCampaignStatus(asClient(fake), "campaign-1", "active"), ServiceError);
});
