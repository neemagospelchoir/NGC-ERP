import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listEventAssignmentsForMember } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const EVENTS: FakeRow[] = [
  { id: "event-1", name: "Worship in Spirit", event_category: "worship_in_spirit", event_date: "2026-04-01", status: "scheduled", qr_token: "qr-e1" },
  { id: "event-2", name: "Community Outreach", event_category: "community_outreach", event_date: "2026-05-01", status: "scheduled", qr_token: "qr-e2" },
  { id: "event-3", name: "Not assigned to Asha", event_category: "other", event_date: "2026-06-01", status: "scheduled", qr_token: "qr-e3" },
];

const EVENT_PARTICIPANTS: FakeRow[] = [
  { id: "ep-1", event_id: "event-1", member_id: "member-asha" },
  { id: "ep-2", event_id: "event-2", member_id: "member-asha" },
  { id: "ep-3", event_id: "event-3", member_id: "member-baraka" },
];

test("listEventAssignmentsForMember returns only the events a member is actually assigned to, sorted by date", async () => {
  const fake = createFakeSupabaseClient({ events: EVENTS, event_participants: EVENT_PARTICIPANTS });
  const result = await listEventAssignmentsForMember(asClient(fake), "member-asha");

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((e) => e.id), ["event-1", "event-2"]);
});

test("listEventAssignmentsForMember returns an empty array for a member with no assignments, without querying events", async () => {
  const fake = createFakeSupabaseClient({ events: EVENTS, event_participants: EVENT_PARTICIPANTS });
  const result = await listEventAssignmentsForMember(asClient(fake), "member-with-no-assignments");
  assert.deepEqual(result, []);
});
