import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updateTrip } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(): FakeRow[] {
  return [
    {
      id: "trip-1",
      event_id: "event-1",
      destination: "Arusha",
      vehicle_requirement: null,
      driver_name: null,
      transport_vendor_id: null,
      accommodation_vendor_id: null,
      departure_at: null,
      arrival_at: null,
      return_departure_at: null,
      return_arrival_at: null,
      estimated_cost: null,
      actual_cost: null,
      currency: "TZS",
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("updateTrip updates the actual cost once travel is complete", async () => {
  const fake = createFakeSupabaseClient({ trips: seed() });
  const trip = await updateTrip(asClient(fake), "trip-1", { actualCost: 150000 });
  assert.equal(trip.actualCost, 150000);
});

test("updateTrip refuses a blank currency", async () => {
  const fake = createFakeSupabaseClient({ trips: seed() });
  await assert.rejects(() => updateTrip(asClient(fake), "trip-1", { currency: "  " }), ServiceError);
});

test("updateTrip refuses an empty update", async () => {
  const fake = createFakeSupabaseClient({ trips: seed() });
  await assert.rejects(() => updateTrip(asClient(fake), "trip-1", {}), ServiceError);
});
