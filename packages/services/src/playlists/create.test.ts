import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createPlaylist } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createPlaylist creates a playlist for an event with no existing one", async () => {
  const fake = createFakeSupabaseClient({ playlists: [] as FakeRow[] });
  const playlist = await createPlaylist(asClient(fake), { eventId: "event-1", createdBy: "user-1" });
  assert.equal(playlist.eventId, "event-1");
  assert.equal(playlist.title, "Event Playlist");
});

test("createPlaylist refuses a second playlist for the same event", async () => {
  const fake = createFakeSupabaseClient({
    playlists: [
      {
        id: "playlist-1",
        event_id: "event-1",
        title: "Event Playlist",
        shared_with_roles: [],
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ] as FakeRow[],
  });
  await assert.rejects(() => createPlaylist(asClient(fake), { eventId: "event-1" }), ServiceError);
});

test("createPlaylist requires an event", async () => {
  const fake = createFakeSupabaseClient({ playlists: [] as FakeRow[] });
  await assert.rejects(() => createPlaylist(asClient(fake), { eventId: "" }), ServiceError);
});
