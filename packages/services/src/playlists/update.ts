import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapPlaylistRow } from "./map";
import type { Playlist, UpdatePlaylistInput } from "./types";

export async function updatePlaylist(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdatePlaylistInput
): Promise<Playlist> {
  const fields: Database["public"]["Tables"]["playlists"]["Update"] = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new ServiceError("Playlist title cannot be blank.");
    fields.title = title;
  }
  if (input.sharedWithRoles !== undefined) fields.shared_with_roles = input.sharedWithRoles;

  if (Object.keys(fields).length === 0) throw new ServiceError("Nothing to update.");

  const { data, error } = await client.from("playlists").update(fields).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the playlist.", error);
  return mapPlaylistRow(data);
}
