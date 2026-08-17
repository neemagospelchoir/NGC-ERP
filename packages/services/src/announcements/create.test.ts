import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createAnnouncement } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createAnnouncement creates a live-by-default announcement authored by the given user", async () => {
  const fake = createFakeSupabaseClient({ announcements: [] });
  const announcement = await createAnnouncement(asClient(fake), {
    title: "Rehearsal moved",
    message: "Saturday rehearsal moves to 3pm.",
    authorId: "user-pro-1",
  });
  assert.equal(announcement.title, "Rehearsal moved");
  assert.equal(announcement.authorId, "user-pro-1");
  assert.equal(announcement.targetAudience, "all");
  assert.equal(announcement.priority, "normal");
  assert.ok(announcement.publishAt);
});

test("createAnnouncement accepts a future publishAt for scheduling", async () => {
  const fake = createFakeSupabaseClient({ announcements: [] });
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const announcement = await createAnnouncement(asClient(fake), {
    title: "Annual retreat",
    message: "Details to follow.",
    authorId: "user-pro-1",
    publishAt: future,
    priority: "high",
    targetAudience: "department",
    targetDepartmentId: "dept-1",
  });
  assert.equal(announcement.publishAt, future);
  assert.equal(announcement.priority, "high");
  assert.equal(announcement.targetDepartmentId, "dept-1");
});

test("createAnnouncement refuses a blank title", async () => {
  const fake = createFakeSupabaseClient({ announcements: [] });
  await assert.rejects(() => createAnnouncement(asClient(fake), { title: "   ", message: "Body", authorId: "user-pro-1" }), ServiceError);
});

test("createAnnouncement refuses a blank message", async () => {
  const fake = createFakeSupabaseClient({ announcements: [] });
  await assert.rejects(() => createAnnouncement(asClient(fake), { title: "Title", message: "  ", authorId: "user-pro-1" }), ServiceError);
});

test("createAnnouncement refuses a missing author", async () => {
  const fake = createFakeSupabaseClient({ announcements: [] });
  await assert.rejects(() => createAnnouncement(asClient(fake), { title: "Title", message: "Body", authorId: "" }), ServiceError);
});
