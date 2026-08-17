import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { generateItinerary } from "./generate";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("generateItinerary creates an itinerary for a trip with no existing one", async () => {
  const fake = createFakeSupabaseClient({ itineraries: [] as FakeRow[] });
  const itinerary = await generateItinerary(asClient(fake), { tripId: "trip-1", assignedMemberIds: ["member-1", "member-2"] });
  assert.equal(itinerary.tripId, "trip-1");
  assert.deepEqual(itinerary.assignedMemberIds, ["member-1", "member-2"]);
  assert.equal(itinerary.generatedDocumentId, null);
});

test("generateItinerary refuses a second itinerary for the same trip", async () => {
  const fake = createFakeSupabaseClient({
    itineraries: [
      {
        id: "itin-1",
        trip_id: "trip-1",
        assigned_member_ids: [],
        generated_at: "2026-01-01T00:00:00.000Z",
        generated_document_id: null,
        notes: null,
      },
    ] as FakeRow[],
  });
  await assert.rejects(() => generateItinerary(asClient(fake), { tripId: "trip-1" }), ServiceError);
});

test("generateItinerary requires a trip", async () => {
  const fake = createFakeSupabaseClient({ itineraries: [] as FakeRow[] });
  await assert.rejects(() => generateItinerary(asClient(fake), { tripId: "" }), ServiceError);
});
