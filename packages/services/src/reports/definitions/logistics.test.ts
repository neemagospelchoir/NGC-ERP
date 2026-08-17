import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runLogisticsReport } from "./logistics";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const TRIPS: FakeRow[] = [
  { id: "trip-1", event_id: "event-1", destination: "Arusha", currency: "TZS", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "trip-2", event_id: "event-2", destination: "Mwanza", currency: "TZS", created_at: "2026-05-01T00:00:00.000Z" },
];

test("runLogisticsReport scopes by the resolved period", async () => {
  const fake = createFakeSupabaseClient({ trips: TRIPS });
  const result = await runLogisticsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.deepEqual(result.rows.map((r) => r.destination), ["Arusha"]);
});
