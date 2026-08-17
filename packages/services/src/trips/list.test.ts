import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listTrips, getTrip } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const TRIPS: FakeRow[] = [
  { id: "trip-1", event_id: "event-1", destination: "Arusha", currency: "TZS", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "trip-2", event_id: "event-2", destination: "Mwanza", currency: "TZS", created_at: "2026-05-01T00:00:00.000Z" },
];

test("listTrips filters by eventId", async () => {
  const fake = createFakeSupabaseClient({ trips: TRIPS });
  const result = await listTrips(asClient(fake), { eventId: "event-1" });
  assert.deepEqual(result.map((t) => t.id), ["trip-1"]);
});

test("listTrips filters by a created_at range — added for Phase 13.2's Logistics Report", async () => {
  const fake = createFakeSupabaseClient({ trips: TRIPS });
  const result = await listTrips(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(result.map((t) => t.id), ["trip-1"]);
});

test("getTrip returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ trips: TRIPS });
  assert.equal(await getTrip(asClient(fake), "missing"), null);
});
