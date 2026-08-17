import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { deleteMediaLink, updateMediaLink } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seedLink(): FakeRow {
  return {
    id: "link-1",
    event_id: null,
    link_type: "youtube",
    url: "https://youtube.com/watch?v=abc",
    title: "Draft clip",
    shared_with_roles: [],
    shared_with_department_ids: [],
    shared_with_member_ids: [],
    is_published: false,
    created_by: "user-media-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

test("updateMediaLink can publish a draft link", async () => {
  const fake = createFakeSupabaseClient({ media_links: [seedLink()] });
  const link = await updateMediaLink(asClient(fake), "link-1", { isPublished: true });
  assert.equal(link.isPublished, true);
});

test("updateMediaLink refuses replacing the URL with a blank one", async () => {
  const fake = createFakeSupabaseClient({ media_links: [seedLink()] });
  await assert.rejects(() => updateMediaLink(asClient(fake), "link-1", { url: "  " }), ServiceError);
});

test("updateMediaLink refuses a non-http(s) URL", async () => {
  const fake = createFakeSupabaseClient({ media_links: [seedLink()] });
  await assert.rejects(() => updateMediaLink(asClient(fake), "link-1", { url: "ftp://example.com" }), ServiceError);
});

test("updateMediaLink can change the sharing scope without publishing", async () => {
  const fake = createFakeSupabaseClient({ media_links: [seedLink()] });
  const link = await updateMediaLink(asClient(fake), "link-1", { sharedWithDepartmentIds: ["dept-1"] });
  assert.deepEqual(link.sharedWithDepartmentIds, ["dept-1"]);
  assert.equal(link.isPublished, false);
});

test("deleteMediaLink hard-deletes the row", async () => {
  const fake = createFakeSupabaseClient({ media_links: [seedLink()] });
  await deleteMediaLink(asClient(fake), "link-1");
  assert.equal((fake.__db.get("media_links") ?? []).length, 0);
});
