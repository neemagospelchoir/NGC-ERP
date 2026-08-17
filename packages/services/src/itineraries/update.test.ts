import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updateItinerary } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(): FakeRow[] {
  return [
    {
      id: "itin-1",
      trip_id: "trip-1",
      assigned_member_ids: ["member-1"],
      generated_at: "2026-01-01T00:00:00.000Z",
      generated_document_id: null,
      notes: null,
    },
  ];
}

test("updateItinerary updates the assigned member list", async () => {
  const fake = createFakeSupabaseClient({ itineraries: seed() });
  const itinerary = await updateItinerary(asClient(fake), "itin-1", { assignedMemberIds: ["member-1", "member-2"] });
  assert.deepEqual(itinerary.assignedMemberIds, ["member-1", "member-2"]);
});

test("updateItinerary refuses an empty update", async () => {
  const fake = createFakeSupabaseClient({ itineraries: seed() });
  await assert.rejects(() => updateItinerary(asClient(fake), "itin-1", {}), ServiceError);
});
