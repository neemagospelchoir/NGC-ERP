import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runContributionsReport } from "./contributions";
import { createFakeSupabaseClient } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("runContributionsReport scopes by the resolved period and resolves member/campaign names", async () => {
  const fake = createFakeSupabaseClient({
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
        status: "confirmed",
        created_at: "2026-02-05T00:00:00.000Z",
      },
      {
        id: "rec-2",
        campaign_id: "camp-1",
        member_id: "member-1",
        amount: 20000,
        currency: "TZS",
        contributed_at: "2026-05-01T00:00:00.000Z",
        status: "confirmed",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
  });

  const result = await runContributionsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.memberName, "Asha Mwakalinga");
  assert.equal(result.rows[0]?.campaignName, "Building Fund");
  assert.equal(result.rows[0]?.amount, 50000);
});
