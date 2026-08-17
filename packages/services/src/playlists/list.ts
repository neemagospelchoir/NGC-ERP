import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapPlaylistItemRow, mapPlaylistRow } from "./map";
import type { Playlist, PlaylistItem } from "./types";

export async function listPlaylists(client: SupabaseClient<Database>): Promise<Playlist[]> {
  const { data, error } = await client.from("playlists").select("*").order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load playlists.", error);
  return (data ?? []).map(mapPlaylistRow);
}

export async function getPlaylist(client: SupabaseClient<Database>, id: string): Promise<Playlist | null> {
  const { data, error } = await client.from("playlists").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the playlist.", error);
  return data ? mapPlaylistRow(data) : null;
}

export async function getPlaylistForEvent(client: SupabaseClient<Database>, eventId: string): Promise<Playlist | null> {
  const { data, error } = await client.from("playlists").select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw new ServiceError("Could not load the playlist.", error);
  return data ? mapPlaylistRow(data) : null;
}

/**
 * An explicit, application-level "playlists for events I participate in"
 * query — NOT a fallback for `playlists_select_scoped` RLS (0009), which
 * already enforces this same narrowing at the database layer regardless of
 * what this function does. It exists as defense-in-depth (the same
 * "belt and suspenders" reasoning as `listAssignmentsForMember`, Phase
 * 8.2) so a non-manager's list page shows a deliberately-scoped result
 * rather than depending entirely on RLS to filter an unscoped `select *` —
 * which also happens to be what makes this behavior possible to exercise
 * against `apps/web/e2e/mock-gotrue-server.mjs`, since that mock does not
 * replicate RLS at all (see its own header doc comment).
 */
export async function listPlaylistsForParticipant(client: SupabaseClient<Database>, memberId: string): Promise<Playlist[]> {
  const { data: participantRows, error: participantError } = await client
    .from("event_participants")
    .select("event_id")
    .eq("member_id", memberId);
  if (participantError) throw new ServiceError("Could not load your event participation.", participantError);

  const eventIds = (participantRows ?? []).map((row) => row.event_id);
  if (eventIds.length === 0) return [];

  const { data, error } = await client
    .from("playlists")
    .select("*")
    .in("event_id", eventIds)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load playlists.", error);
  return (data ?? []).map(mapPlaylistRow);
}

export async function listPlaylistItems(client: SupabaseClient<Database>, playlistId: string): Promise<PlaylistItem[]> {
  const { data, error } = await client
    .from("playlist_items")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("sequence_number", { ascending: true });
  if (error) throw new ServiceError("Could not load playlist items.", error);
  return (data ?? []).map(mapPlaylistItemRow);
}
