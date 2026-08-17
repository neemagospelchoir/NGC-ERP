import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listTechnicalRiders, getTechnicalRiderForEvent } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const RIDERS: FakeRow[] = [
  { id: "rider-1", event_id: "event-1", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "rider-2", event_id: "event-2", created_at: "2026-05-01T00:00:00.000Z" },
];

test("listTechnicalRiders with no options returns every rider (existing caller behavior unaffected)", async () => {
  const fake = createFakeSupabaseClient({ technical_riders: RIDERS });
  const result = await listTechnicalRiders(asClient(fake));
  assert.equal(result.length, 2);
});

test("listTechnicalRiders filters by a created_at range — added for Phase 13.2's Technical Report", async () => {
  const fake = createFakeSupabaseClient({ technical_riders: RIDERS });
  const result = await listTechnicalRiders(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(result.map((r) => r.id), ["rider-1"]);
});

test("getTechnicalRiderForEvent returns null when no rider exists for that event", async () => {
  const fake = createFakeSupabaseClient({ technical_riders: RIDERS });
  assert.equal(await getTechnicalRiderForEvent(asClient(fake), "event-missing"), null);
});
