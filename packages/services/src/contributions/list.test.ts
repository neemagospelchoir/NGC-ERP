import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listContributionsInPeriod } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    members: [{ id: "member-1", first_name: "Asha", last_name: "Mwakalinga" }],
    contribution_campaigns: [{ id: "camp-1", name: "Building Fund" }],
    contribution_records: [
      {
        id: "rec-1",
        campaign_id: "camp-1",
        member_id: "member-1",
        amount: 50000,
        currency: "TZS",
        contributed_at: "2026-02-05T00:00:00.000Z",
        payment_method: "cash",
        reference: null,
        status: "confirmed",
        notes: null,
        recorded_by: null,
        created_at: "2026-02-05T00:00:00.000Z",
      },
      {
        id: "rec-2",
        campaign_id: "camp-1",
        member_id: "member-1",
        amount: 20000,
        currency: "TZS",
        contributed_at: "2026-05-01T00:00:00.000Z", // outside the period
        payment_method: "mobile_money",
        reference: null,
        status: "reversed",
        notes: null,
        recorded_by: null,
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
  });
}

test("listContributionsInPeriod scopes by contributed_at and resolves member/campaign names — added for Phase 13.2's Contribution Report", async () => {
  const fake = seed();
  const result = await listContributionsInPeriod(asClient(fake), { contributedFrom: "2026-02-01", contributedTo: "2026-02-28" });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.memberName, "Asha Mwakalinga");
  assert.equal(result[0]?.campaignName, "Building Fund");
});

test("listContributionsInPeriod additionally narrows by status", async () => {
  const fake = seed();
  const result = await listContributionsInPeriod(asClient(fake), { status: "reversed" });
  assert.deepEqual(result.map((r) => r.id), ["rec-2"]);
});
