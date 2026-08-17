import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listPlaylistsForParticipant } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function playlistRow(id: string, eventId: string): FakeRow {
  return {
    id,
    event_id: eventId,
    title: "Event Playlist",
    shared_with_roles: [],
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

test("listPlaylistsForParticipant returns only playlists for events the member participates in", async () => {
  const fake = createFakeSupabaseClient({
    event_participants: [{ id: "ep-1", event_id: "event-1", member_id: "member-1" }] as FakeRow[],
    playlists: [playlistRow("playlist-1", "event-1"), playlistRow("playlist-2", "event-2")] as FakeRow[],
  });
  const rows = await listPlaylistsForParticipant(asClient(fake), "member-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "playlist-1");
});

test("listPlaylistsForParticipant returns an empty list for a member with no event participation", async () => {
  const fake = createFakeSupabaseClient({
    event_participants: [] as FakeRow[],
    playlists: [playlistRow("playlist-1", "event-1")] as FakeRow[],
  });
  const rows = await listPlaylistsForParticipant(asClient(fake), "member-1");
  assert.deepEqual(rows, []);
});
