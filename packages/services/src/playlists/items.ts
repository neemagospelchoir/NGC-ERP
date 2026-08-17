import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapPlaylistItemRow } from "./map";
import type { AddPlaylistItemInput, PlaylistItem, UpdatePlaylistItemInput } from "./types";

/**
 * `unique (playlist_id, sequence_number)` (0009) is the database's own
 * ordering guarantee — two songs can never claim the same slot. A
 * duplicate-sequence insert/update surfaces here as a generic constraint
 * error from Postgres; rather than trying to guess Postgres's error shape
 * client-side, this simply lets the friendly message below cover it, same
 * as `addGatePassItem`'s handling of `assignAsset`'s own constraint (Phase
 * 8.3) — the caller sees "could not add", not a raw SQL error.
 */
export async function addPlaylistItem(
  client: SupabaseClient<Database>,
  playlistId: string,
  input: AddPlaylistItemInput
): Promise<PlaylistItem> {
  const songTitle = input.songTitle.trim();
  if (!songTitle) throw new ServiceError("A song title is required.");
  if (!Number.isInteger(input.sequenceNumber) || input.sequenceNumber < 1) {
    throw new ServiceError("Sequence number must be a positive whole number.");
  }

  const { data, error } = await client
    .from("playlist_items")
    .insert({
      playlist_id: playlistId,
      sequence_number: input.sequenceNumber,
      song_title: songTitle,
      musical_key: input.musicalKey ?? null,
      duration_seconds: input.durationSeconds ?? null,
      lead_vocal_member_id: input.leadVocalMemberId ?? null,
      backing_vocal_member_ids: input.backingVocalMemberIds ?? [],
      instrument: input.instrument ?? null,
      technical_notes: input.technicalNotes ?? null,
    })
    .select("*")
    .single();
  if (error) {
    throw new ServiceError(
      error.code === "23505" ? `Sequence position ${input.sequenceNumber} is already taken on this playlist.` : "Could not add the song to the playlist.",
      error
    );
  }
  return mapPlaylistItemRow(data);
}

/**
 * `updatePlaylistItem`/`removePlaylistItem` (below) take only `itemId`, not
 * `playlistId` — they do not verify the item actually belongs to whatever
 * playlist the caller's URL/form claims. A security review of this phase
 * confirmed this is not a privilege boundary: `playlist_items_write_
 * technical` RLS (0009) gates writes on the GLOBAL `technical.playlists.
 * manage` permission, not a per-playlist/per-event scope, so anyone who can
 * reach this function at all can already write to every playlist's items
 * table-wide — a mismatched `playlistId` only mislabels which page gets
 * `revalidatePath`'d (apps/web/app/(erp)/playlists/actions.ts), not an
 * access-control gap. Left as-is rather than adding a redundant ownership
 * check for a boundary RLS doesn't actually draw.
 */
export async function updatePlaylistItem(
  client: SupabaseClient<Database>,
  itemId: string,
  input: UpdatePlaylistItemInput
): Promise<PlaylistItem> {
  const fields: Database["public"]["Tables"]["playlist_items"]["Update"] = {};
  if (input.sequenceNumber !== undefined) {
    if (!Number.isInteger(input.sequenceNumber) || input.sequenceNumber < 1) {
      throw new ServiceError("Sequence number must be a positive whole number.");
    }
    fields.sequence_number = input.sequenceNumber;
  }
  if (input.songTitle !== undefined) {
    const songTitle = input.songTitle.trim();
    if (!songTitle) throw new ServiceError("A song title is required.");
    fields.song_title = songTitle;
  }
  if (input.musicalKey !== undefined) fields.musical_key = input.musicalKey;
  if (input.durationSeconds !== undefined) fields.duration_seconds = input.durationSeconds;
  if (input.leadVocalMemberId !== undefined) fields.lead_vocal_member_id = input.leadVocalMemberId;
  if (input.backingVocalMemberIds !== undefined) fields.backing_vocal_member_ids = input.backingVocalMemberIds;
  if (input.instrument !== undefined) fields.instrument = input.instrument;
  if (input.technicalNotes !== undefined) fields.technical_notes = input.technicalNotes;

  if (Object.keys(fields).length === 0) throw new ServiceError("Nothing to update.");

  const { data, error } = await client.from("playlist_items").update(fields).eq("id", itemId).select("*").single();
  if (error) {
    throw new ServiceError(
      error.code === "23505" ? "That sequence position is already taken on this playlist." : "Could not update the song.",
      error
    );
  }
  return mapPlaylistItemRow(data);
}

export async function removePlaylistItem(client: SupabaseClient<Database>, itemId: string): Promise<void> {
  const { error } = await client.from("playlist_items").delete().eq("id", itemId);
  if (error) throw new ServiceError("Could not remove the song from the playlist.", error);
}
