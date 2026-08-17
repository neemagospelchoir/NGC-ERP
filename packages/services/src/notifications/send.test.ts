import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { sendNotification } from "./send";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function usersSeed(): FakeRow[] {
  return [
    { id: "user-1", is_active: true },
    { id: "user-2", is_active: true },
    { id: "user-3", is_active: false },
  ];
}

function membersSeed(): FakeRow[] {
  return [
    { id: "member-1", primary_department_id: "dept-1", family_id: "fam-1", user_id: "user-1" },
    { id: "member-2", primary_department_id: "dept-1", family_id: "fam-2", user_id: "user-2" },
    { id: "member-3", primary_department_id: "dept-2", family_id: "fam-1", user_id: null },
  ];
}

/**
 * Mirrors `send_notification` (0033)'s own SQL mechanics — audience
 * resolution + bulk insert — WITHOUT re-checking `has_permission(
 * 'communications.notifications.send')`, the same division of labor
 * already established for every other RPC stub in this codebase (the mock
 * exercises mechanics; the real migration's SQL, verified directly against
 * live Postgres per docs/PHASE_10_2.md §2.1, is what actually enforces the
 * permission check). This function is a stand-in for the RPC specifically
 * BECAUSE `sendNotification` no longer performs audience resolution or the
 * insert-with-RETURNING itself client-side — see `send.ts`'s own doc
 * comment for why: 0033 exists because that approach is fundamentally
 * broken under real RLS for any non-`super_admin` sender.
 */
function makeSendNotificationRpcStub(fake: ReturnType<typeof createFakeSupabaseClient>) {
  return async (args: Record<string, unknown>) => {
    const audience = args.p_audience as string;
    let recipientIds: string[] = [];

    if (audience === "all") {
      recipientIds = (fake.__db.get("users") ?? []).filter((u) => u.is_active).map((u) => u.id as string);
    } else if (audience === "department") {
      if (!args.p_department_id) return { data: null, error: { message: "A department is required for this audience" } };
      recipientIds = (fake.__db.get("members") ?? [])
        .filter((m) => m.primary_department_id === args.p_department_id && m.user_id)
        .map((m) => m.user_id as string);
    } else if (audience === "family") {
      if (!args.p_family_id) return { data: null, error: { message: "A family is required for this audience" } };
      recipientIds = (fake.__db.get("members") ?? []).filter((m) => m.family_id === args.p_family_id && m.user_id).map((m) => m.user_id as string);
    } else if (audience === "specific_users") {
      recipientIds = (args.p_user_ids as string[] | null) ?? [];
    }

    recipientIds = Array.from(new Set(recipientIds));
    if (recipientIds.length === 0) return { data: null, error: { message: "No recipients matched this audience" } };

    const isInApp = args.p_channel === "in_app";
    const nowIso = new Date().toISOString();
    const notifications = fake.__db.get("notifications") ?? [];
    fake.__db.set("notifications", notifications);
    const inserted = recipientIds.map((recipientUserId, index) => {
      const row: FakeRow = {
        id: `notif-${notifications.length + index}`,
        recipient_user_id: recipientUserId,
        template_id: args.p_template_id ?? null,
        channel: args.p_channel,
        subject: args.p_subject ?? null,
        body: args.p_body,
        triggering_event: args.p_triggering_event ?? null,
        triggering_record_type: args.p_triggering_record_type ?? null,
        triggering_record_id: args.p_triggering_record_id ?? null,
        status: isInApp ? "sent" : "queued",
        sent_at: isInApp ? nowIso : null,
        read_at: null,
        failure_reason: null,
        created_at: nowIso,
      };
      notifications.push(row);
      return row;
    });
    return { data: inserted, error: null };
  };
}

function seed(dataset: Record<string, FakeRow[]>) {
  const fake = createFakeSupabaseClient(dataset);
  const stub = makeSendNotificationRpcStub(fake);
  return {
    ...fake,
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      if (fn === "send_notification") return stub(args);
      return { data: null, error: { message: `unstubbed rpc "${fn}"` } };
    },
  } as unknown as ReturnType<typeof createFakeSupabaseClient>;
}

test("sendNotification fans out to every active user for the 'all' audience, in_app is sent immediately", async () => {
  const fake = seed({ users: usersSeed(), notifications: [] });
  const result = await sendNotification(asClient(fake), { channel: "in_app", body: "Rehearsal at 5pm", audience: "all" });
  assert.equal(result.recipientCount, 2);
  assert.ok(result.notifications.every((n) => n.status === "sent" && n.sentAt));
});

test("sendNotification resolves the department audience to members with a linked user account", async () => {
  const fake = seed({ members: membersSeed(), notifications: [] });
  const result = await sendNotification(asClient(fake), {
    channel: "in_app",
    body: "Dept meeting",
    audience: "department",
    departmentId: "dept-1",
  });
  assert.equal(result.recipientCount, 2);
  assert.deepEqual(
    result.notifications.map((n) => n.recipientUserId).sort(),
    ["user-1", "user-2"]
  );
});

test("sendNotification resolves the family audience the same way", async () => {
  const fake = seed({ members: membersSeed(), notifications: [] });
  const result = await sendNotification(asClient(fake), { channel: "in_app", body: "Family gathering", audience: "family", familyId: "fam-1" });
  assert.equal(result.recipientCount, 1);
  assert.equal(result.notifications[0]?.recipientUserId, "user-1");
});

test("sendNotification accepts explicit user IDs for specific_users, deduplicated", async () => {
  const fake = seed({ notifications: [] });
  const result = await sendNotification(asClient(fake), {
    channel: "in_app",
    body: "Direct message",
    audience: "specific_users",
    userIds: ["user-1", "user-2", "user-1"],
  });
  assert.equal(result.recipientCount, 2);
});

test("sendNotification queues, rather than sends, a non-in_app channel", async () => {
  const fake = seed({ notifications: [] });
  const result = await sendNotification(asClient(fake), {
    channel: "sms",
    body: "Emergency notice",
    audience: "specific_users",
    userIds: ["user-1"],
  });
  assert.equal(result.notifications[0]?.status, "queued");
  assert.equal(result.notifications[0]?.sentAt, null);
});

test("sendNotification refuses a blank body", async () => {
  const fake = seed({ notifications: [] });
  await assert.rejects(
    () => sendNotification(asClient(fake), { channel: "in_app", body: "  ", audience: "specific_users", userIds: ["user-1"] }),
    ServiceError
  );
});

test("sendNotification refuses when no recipients match", async () => {
  const fake = seed({ users: [], notifications: [] });
  await assert.rejects(() => sendNotification(asClient(fake), { channel: "in_app", body: "Body", audience: "all" }), ServiceError);
});

test("sendNotification refuses a department audience with no departmentId", async () => {
  const fake = seed({ notifications: [] });
  await assert.rejects(() => sendNotification(asClient(fake), { channel: "in_app", body: "Body", audience: "department" }), ServiceError);
});

test("sendNotification refuses a specific_users audience with no user IDs", async () => {
  const fake = seed({ notifications: [] });
  await assert.rejects(() => sendNotification(asClient(fake), { channel: "in_app", body: "Body", audience: "specific_users" }), ServiceError);
});
