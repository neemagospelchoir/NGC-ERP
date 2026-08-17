import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { upsertTechnicalRider } from "./upsert";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("upsertTechnicalRider inserts a new row when the event has none yet", async () => {
  const fake = createFakeSupabaseClient({ technical_riders: [] as FakeRow[] });
  const rider = await upsertTechnicalRider(asClient(fake), {
    eventId: "event-1",
    paRequirements: "2x line array",
    setupTime: "2026-12-01T08:00:00.000Z",
  });
  assert.equal(rider.eventId, "event-1");
  assert.equal(rider.paRequirements, "2x line array");
  assert.equal(rider.lightingRequirements, null);
});

test("upsertTechnicalRider updates the existing row for the event rather than creating a second one", async () => {
  const fake = createFakeSupabaseClient({
    technical_riders: [
      {
        id: "rider-1",
        event_id: "event-1",
        pa_requirements: "old",
        lighting_requirements: null,
        led_display_requirements: null,
        camera_requirements: null,
        recording_requirements: null,
        power_requirements: null,
        stage_requirements: null,
        monitoring_requirements: null,
        crew_notes: null,
        setup_time: null,
        soundcheck_time: null,
        technical_notes: null,
        prepared_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ] as FakeRow[],
  });
  const rider = await upsertTechnicalRider(asClient(fake), { eventId: "event-1", paRequirements: "new" });
  assert.equal(rider.id, "rider-1");
  assert.equal(rider.paRequirements, "new");
});

test("upsertTechnicalRider requires an event", async () => {
  const fake = createFakeSupabaseClient({ technical_riders: [] as FakeRow[] });
  await assert.rejects(() => upsertTechnicalRider(asClient(fake), { eventId: "" }), ServiceError);
});
