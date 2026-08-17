import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createMediaLink } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createMediaLink creates an unpublished-by-default link with no event", async () => {
  const fake = createFakeSupabaseClient({ media_links: [] });
  const link = await createMediaLink(asClient(fake), {
    linkType: "youtube",
    url: "https://youtube.com/watch?v=abc",
    createdBy: "user-media-1",
  });
  assert.equal(link.linkType, "youtube");
  assert.equal(link.isPublished, false);
  assert.equal(link.eventId, null);
  assert.equal(link.createdBy, "user-media-1");
});

test("createMediaLink accepts an event, title, publish flag, and sharing scope", async () => {
  const fake = createFakeSupabaseClient({ media_links: [] });
  const link = await createMediaLink(asClient(fake), {
    linkType: "press_release",
    url: "https://example.com/press",
    title: "Annual concert coverage",
    eventId: "event-1",
    isPublished: true,
    sharedWithDepartmentIds: ["dept-1"],
    sharedWithRoles: ["pro_spokesperson"],
    sharedWithMemberIds: ["member-1"],
    createdBy: "user-media-1",
  });
  assert.equal(link.eventId, "event-1");
  assert.equal(link.title, "Annual concert coverage");
  assert.equal(link.isPublished, true);
  assert.deepEqual(link.sharedWithDepartmentIds, ["dept-1"]);
  assert.deepEqual(link.sharedWithRoles, ["pro_spokesperson"]);
  assert.deepEqual(link.sharedWithMemberIds, ["member-1"]);
});

test("createMediaLink refuses a blank URL", async () => {
  const fake = createFakeSupabaseClient({ media_links: [] });
  await assert.rejects(() => createMediaLink(asClient(fake), { linkType: "other", url: "  ", createdBy: "user-media-1" }), ServiceError);
});

test("createMediaLink refuses a URL with no http(s) scheme", async () => {
  const fake = createFakeSupabaseClient({ media_links: [] });
  await assert.rejects(
    () => createMediaLink(asClient(fake), { linkType: "other", url: "not-a-url", createdBy: "user-media-1" }),
    ServiceError
  );
});

test("createMediaLink refuses a missing creator", async () => {
  const fake = createFakeSupabaseClient({ media_links: [] });
  await assert.rejects(
    () => createMediaLink(asClient(fake), { linkType: "other", url: "https://example.com", createdBy: "" }),
    ServiceError
  );
});
