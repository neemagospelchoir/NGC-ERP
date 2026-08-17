import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { addPlaylistItem, removePlaylistItem, updatePlaylistItem } from "./items";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("addPlaylistItem adds a song at the given sequence position", async () => {
  const fake = createFakeSupabaseClient({ playlist_items: [] as FakeRow[] });
  const item = await addPlaylistItem(asClient(fake), "playlist-1", {
    sequenceNumber: 1,
    songTitle: "Amazing Grace",
    musicalKey: "G",
  });
  assert.equal(item.playlistId, "playlist-1");
  assert.equal(item.songTitle, "Amazing Grace");
  assert.equal(item.sequenceNumber, 1);
  assert.deepEqual(item.backingVocalMemberIds, []);
});

test("addPlaylistItem requires a song title", async () => {
  const fake = createFakeSupabaseClient({ playlist_items: [] as FakeRow[] });
  await assert.rejects(() => addPlaylistItem(asClient(fake), "playlist-1", { sequenceNumber: 1, songTitle: "  " }), ServiceError);
});

test("addPlaylistItem requires a positive whole-number sequence position", async () => {
  const fake = createFakeSupabaseClient({ playlist_items: [] as FakeRow[] });
  await assert.rejects(
    () => addPlaylistItem(asClient(fake), "playlist-1", { sequenceNumber: 0, songTitle: "Amazing Grace" }),
    ServiceError
  );
  await assert.rejects(
    () => addPlaylistItem(asClient(fake), "playlist-1", { sequenceNumber: 1.5, songTitle: "Amazing Grace" }),
    ServiceError
  );
});

function seedItem(): FakeRow[] {
  return [
    {
      id: "item-1",
      playlist_id: "playlist-1",
      sequence_number: 1,
      song_title: "Amazing Grace",
      musical_key: null,
      duration_seconds: null,
      lead_vocal_member_id: null,
      backing_vocal_member_ids: [],
      instrument: null,
      technical_notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

test("updatePlaylistItem updates the song title", async () => {
  const fake = createFakeSupabaseClient({ playlist_items: seedItem() });
  const item = await updatePlaylistItem(asClient(fake), "item-1", { songTitle: "How Great Thou Art" });
  assert.equal(item.songTitle, "How Great Thou Art");
});

test("updatePlaylistItem refuses an empty update", async () => {
  const fake = createFakeSupabaseClient({ playlist_items: seedItem() });
  await assert.rejects(() => updatePlaylistItem(asClient(fake), "item-1", {}), ServiceError);
});

test("removePlaylistItem removes the item", async () => {
  const fake = createFakeSupabaseClient({ playlist_items: seedItem() });
  await removePlaylistItem(asClient(fake), "item-1");
  const { data } = await asClient(fake).from("playlist_items").select("*").eq("id", "item-1").maybeSingle();
  assert.equal(data, null);
});
