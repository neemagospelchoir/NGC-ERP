import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updateAnnouncement, deleteAnnouncement } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(): FakeRow[] {
  return [
    {
      id: "ann-1",
      title: "Original title",
      message: "Original message",
      image_url: null,
      attachment_document_id: null,
      target_audience: "all",
      target_department_id: null,
      target_family_id: null,
      target_event_id: null,
      target_user_ids: [],
      priority: "normal",
      publish_at: "2026-01-01T00:00:00.000Z",
      expiry_at: null,
      author_id: "user-pro-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("updateAnnouncement updates title/message/priority", async () => {
  const fake = createFakeSupabaseClient({ announcements: seed() });
  const updated = await updateAnnouncement(asClient(fake), "ann-1", {
    title: "Updated title",
    message: "Updated message",
    priority: "urgent",
  });
  assert.equal(updated.title, "Updated title");
  assert.equal(updated.priority, "urgent");
});

test("updateAnnouncement refuses a blank title", async () => {
  const fake = createFakeSupabaseClient({ announcements: seed() });
  await assert.rejects(() => updateAnnouncement(asClient(fake), "ann-1", { title: " ", message: "Body" }), ServiceError);
});

test("deleteAnnouncement removes the row", async () => {
  const fake = createFakeSupabaseClient({ announcements: seed() });
  await deleteAnnouncement(asClient(fake), "ann-1");
  const { data } = await asClient(fake).from("announcements").select("*").eq("id", "ann-1").maybeSingle();
  assert.equal(data, null);
});
