import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runTechnicalReport } from "./technical";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const EVENTS: FakeRow[] = [{ id: "event-1", name: "Easter Concert", event_category: "internal_performance", event_date: "2026-04-05", status: "confirmed", qr_token: "qr-1" }];
const RIDERS: FakeRow[] = [
  { id: "rider-1", event_id: "event-1", prepared_by: "Technical Manager", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "rider-2", event_id: "event-1", prepared_by: "Technical Manager", created_at: "2026-05-01T00:00:00.000Z" },
];

test("runTechnicalReport scopes by the resolved period and resolves the event name", async () => {
  const fake = createFakeSupabaseClient({ technical_riders: RIDERS, events: EVENTS });
  const result = await runTechnicalReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.event, "Easter Concert");
});
