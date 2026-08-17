import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getMediaLink, listMediaLinks } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function linkRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "link-1",
    event_id: "event-1",
    link_type: "youtube",
    url: "https://youtube.com/watch?v=abc",
    title: "Sunday service",
    shared_with_roles: [],
    shared_with_department_ids: [],
    shared_with_member_ids: [],
    is_published: true,
    created_by: "user-media-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("listMediaLinks returns every row the caller's own RLS session can see (this fixture applies no RLS itself — see docs/PHASE_11.md for the live-Postgres verification)", async () => {
  const fake = createFakeSupabaseClient({ media_links: [linkRow(), linkRow({ id: "link-2", event_id: "event-2" })] });
  const rows = await listMediaLinks(asClient(fake));
  assert.equal(rows.length, 2);
});

test("listMediaLinks filters by eventId when given", async () => {
  const fake = createFakeSupabaseClient({ media_links: [linkRow(), linkRow({ id: "link-2", event_id: "event-2" })] });
  const rows = await listMediaLinks(asClient(fake), { eventId: "event-2" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "link-2");
});

test("getMediaLink returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ media_links: [linkRow()] });
  assert.equal(await getMediaLink(asClient(fake), "does-not-exist"), null);
});

test("getMediaLink maps sharing-scope arrays", async () => {
  const fake = createFakeSupabaseClient({
    media_links: [linkRow({ shared_with_roles: ["pro_spokesperson"], shared_with_department_ids: ["dept-1"], shared_with_member_ids: ["member-1"] })],
  });
  const link = await getMediaLink(asClient(fake), "link-1");
  assert.deepEqual(link?.sharedWithRoles, ["pro_spokesperson"]);
  assert.deepEqual(link?.sharedWithDepartmentIds, ["dept-1"]);
  assert.deepEqual(link?.sharedWithMemberIds, ["member-1"]);
});
