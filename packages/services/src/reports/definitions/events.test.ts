import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runEventsReport } from "./events";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const EVENTS: FakeRow[] = [
  { id: "event-1", name: "Easter Concert", event_category: "internal_performance", event_date: "2026-02-10", status: "confirmed", qr_token: "qr-1" },
  { id: "event-2", name: "Later Event", event_category: "internal_performance", event_date: "2026-05-01", status: "confirmed", qr_token: "qr-2" },
];

test("runEventsReport scopes by event_date within the resolved period", async () => {
  const fake = createFakeSupabaseClient({ events: EVENTS });
  const result = await runEventsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.deepEqual(result.rows.map((r) => r.name), ["Easter Concert"]);
});
