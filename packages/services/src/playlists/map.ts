import type { Database } from "@ngc/db";
import type { Playlist, PlaylistItem } from "./types";

type PlaylistRow = Database["public"]["Tables"]["playlists"]["Row"];
type PlaylistItemRow = Database["public"]["Tables"]["playlist_items"]["Row"];

export function mapPlaylistRow(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    sharedWithRoles: row.shared_with_roles,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlaylistItemRow(row: PlaylistItemRow): PlaylistItem {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    sequenceNumber: row.sequence_number,
    songTitle: row.song_title,
    musicalKey: row.musical_key,
    durationSeconds: row.duration_seconds,
    leadVocalMemberId: row.lead_vocal_member_id,
    backingVocalMemberIds: row.backing_vocal_member_ids,
    instrument: row.instrument,
    technicalNotes: row.technical_notes,
    createdAt: row.created_at,
  };
}
