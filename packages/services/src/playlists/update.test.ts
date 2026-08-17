import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updatePlaylist } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(): FakeRow[] {
  return [
    {
      id: "playlist-1",
      event_id: "event-1",
      title: "Event Playlist",
      shared_with_roles: [],
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("updatePlaylist updates the title", async () => {
  const fake = createFakeSupabaseClient({ playlists: seed() });
  const playlist = await updatePlaylist(asClient(fake), "playlist-1", { title: "Christmas Concert Playlist" });
  assert.equal(playlist.title, "Christmas Concert Playlist");
});

test("updatePlaylist updates shared_with_roles", async () => {
  const fake = createFakeSupabaseClient({ playlists: seed() });
  const playlist = await updatePlaylist(asClient(fake), "playlist-1", { sharedWithRoles: ["secretary"] });
  assert.deepEqual(playlist.sharedWithRoles, ["secretary"]);
});

test("updatePlaylist refuses a blank title", async () => {
  const fake = createFakeSupabaseClient({ playlists: seed() });
  await assert.rejects(() => updatePlaylist(asClient(fake), "playlist-1", { title: "   " }), ServiceError);
});

test("updatePlaylist refuses an empty update", async () => {
  const fake = createFakeSupabaseClient({ playlists: seed() });
  await assert.rejects(() => updatePlaylist(asClient(fake), "playlist-1", {}), ServiceError);
});
