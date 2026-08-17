import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createTrip } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createTrip creates a trip with a default TZS currency", async () => {
  const fake = createFakeSupabaseClient({ trips: [] as FakeRow[] });
  const trip = await createTrip(asClient(fake), { eventId: "event-1", destination: "Arusha" });
  assert.equal(trip.eventId, "event-1");
  assert.equal(trip.destination, "Arusha");
  assert.equal(trip.currency, "TZS");
});

test("createTrip respects an explicit currency", async () => {
  const fake = createFakeSupabaseClient({ trips: [] as FakeRow[] });
  const trip = await createTrip(asClient(fake), { eventId: "event-1", currency: "USD" });
  assert.equal(trip.currency, "USD");
});

test("createTrip allows more than one trip for the same event", async () => {
  const fake = createFakeSupabaseClient({ trips: [] as FakeRow[] });
  await createTrip(asClient(fake), { eventId: "event-1", destination: "Arusha" });
  const second = await createTrip(asClient(fake), { eventId: "event-1", destination: "Moshi" });
  assert.equal(second.destination, "Moshi");
});

test("createTrip requires an event", async () => {
  const fake = createFakeSupabaseClient({ trips: [] as FakeRow[] });
  await assert.rejects(() => createTrip(asClient(fake), { eventId: "" }), ServiceError);
});
