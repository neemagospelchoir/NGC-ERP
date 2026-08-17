import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { recordContribution, reverseContribution } from "./record";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seedActiveCampaign(status = "active"): FakeRow[] {
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

test("recordContribution records a confirmed contribution", async () => {
  const fake = createFakeSupabaseClient({
    contribution_campaigns: seedActiveCampaign(),
    contribution_records: [] as FakeRow[],
  });
  const record = await recordContribution(asClient(fake), {
    campaignId: "campaign-1",
    memberId: "member-1",
    amount: 50000,
    paymentMethod: "mobile_money",
  });
  assert.equal(record.status, "confirmed");
  assert.equal(record.amount, 50000);
});

test("recordContribution requires a campaign and member", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seedActiveCampaign(), contribution_records: [] as FakeRow[] });
  await assert.rejects(() => recordContribution(asClient(fake), { campaignId: "", memberId: "member-1", amount: 100 }), ServiceError);
  await assert.rejects(() => recordContribution(asClient(fake), { campaignId: "campaign-1", memberId: "", amount: 100 }), ServiceError);
});

test("recordContribution refuses a negative amount", async () => {
  const fake = createFakeSupabaseClient({ contribution_campaigns: seedActiveCampaign(), contribution_records: [] as FakeRow[] });
  await assert.rejects(
    () => recordContribution(asClient(fake), { campaignId: "campaign-1", memberId: "member-1", amount: -10 }),
    ServiceError
  );
});

// Security-review regression: recording against a closed/cancelled
// campaign used to succeed silently (neither the service layer nor RLS
// checked the parent campaign's status).
test("recordContribution refuses to record against a closed campaign", async () => {
  const fake = createFakeSupabaseClient({
    contribution_campaigns: seedActiveCampaign("closed"),
    contribution_records: [] as FakeRow[],
  });
  await assert.rejects(
    () => recordContribution(asClient(fake), { campaignId: "campaign-1", memberId: "member-1", amount: 100 }),
    ServiceError
  );
});

function seedRecord(status = "confirmed"): FakeRow[] {
  return [
    {
      id: "record-1",
      campaign_id: "campaign-1",
      member_id: "member-1",
      amount: 50000,
      currency: "TZS",
      contributed_at: "2026-01-01",
      payment_method: "cash",
      reference: null,
      status,
      notes: null,
      recorded_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("reverseContribution marks a confirmed contribution as reversed", async () => {
  const fake = createFakeSupabaseClient({ contribution_records: seedRecord() });
  const record = await reverseContribution(asClient(fake), "record-1");
  assert.equal(record.status, "reversed");
});

test("reverseContribution refuses to reverse an already-reversed contribution", async () => {
  const fake = createFakeSupabaseClient({ contribution_records: seedRecord("reversed") });
  await assert.rejects(() => reverseContribution(asClient(fake), "record-1"), ServiceError);
});
