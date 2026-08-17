import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listMyNotifications, markNotificationRead } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(): FakeRow[] {
  return [
    {
      id: "notif-1",
      recipient_user_id: "user-1",
      template_id: null,
      channel: "in_app",
      subject: null,
      body: "Rehearsal at 5pm",
      triggering_event: null,
      triggering_record_type: null,
      triggering_record_id: null,
      status: "sent",
      sent_at: "2026-01-01T00:00:00.000Z",
      read_at: null,
      failure_reason: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "notif-2",
      recipient_user_id: "user-2",
      template_id: null,
      channel: "in_app",
      subject: null,
      body: "Someone else's notification",
      triggering_event: null,
      triggering_record_type: null,
      triggering_record_id: null,
      status: "sent",
      sent_at: "2026-01-01T00:00:00.000Z",
      read_at: null,
      failure_reason: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("listMyNotifications only returns the given recipient's own notifications", async () => {
  const fake = createFakeSupabaseClient({ notifications: seed() });
  const mine = await listMyNotifications(asClient(fake), "user-1");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.id, "notif-1");
});

test("markNotificationRead sets status and read_at", async () => {
  const fake = createFakeSupabaseClient({ notifications: seed() });
  const updated = await markNotificationRead(asClient(fake), "notif-1");
  assert.equal(updated.status, "read");
  assert.ok(updated.readAt);
});
