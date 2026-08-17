import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createEventFromInvitation } from "./create-from-invitation";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createEventFromInvitation creates a scheduled, invitation-category event", async () => {
  const fake = createFakeSupabaseClient({ events: [] });
  const event = await createEventFromInvitation(asClient(fake), {
    invitationId: "inv-1",
    name: "Crown TV Recording",
    eventDate: "2026-03-01",
    startTime: "18:00",
    venue: "Chang'ombe",
    location: "Dar es Salaam",
  });
  assert.equal(event.eventCategory, "invitation");
  assert.equal(event.status, "scheduled");
  assert.equal(event.invitationId, "inv-1");
});

test("createEventFromInvitation is idempotent — a second call for the same invitation returns the existing event", async () => {
  const fake = createFakeSupabaseClient({ events: [] });
  const first = await createEventFromInvitation(asClient(fake), { invitationId: "inv-1", name: "Event", eventDate: "2026-03-01" });
  const second = await createEventFromInvitation(asClient(fake), { invitationId: "inv-1", name: "Event (retried)", eventDate: "2026-03-01" });
  assert.equal(first.id, second.id);
  assert.equal(second.name, "Event"); // untouched by the retried call
  assert.equal((fake.__db.get("events") ?? []).length, 1);
});
