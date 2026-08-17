import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapPlaylistRow } from "./map";
import type { CreatePlaylistInput, Playlist } from "./types";

/**
 * `playlists.event_id` is `unique` (0009) — one playlist per event, unlike
 * the rider (which is edited in place via `upsertTechnicalRider`), a
 * playlist is only ever created once and then updated via `updatePlaylist`/
 * the `playlist_items` CRUD in `items.ts` — there is no "replace the whole
 * playlist" action, so a plain insert (checked first, for a friendly
 * message) is enough here; no upsert-style helper is needed.
 */
export async function createPlaylist(client: SupabaseClient<Database>, input: CreatePlaylistInput): Promise<Playlist> {
  if (!input.eventId) throw new ServiceError("An event is required.");

  const { data: existing, error: existingError } = await client
    .from("playlists")
    .select("id")
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check for an existing playlist.", existingError);
  if (existing) throw new ServiceError("This event already has a playlist.");

  const { data, error } = await client
    .from("playlists")
    .insert({
      event_id: input.eventId,
      title: input.title?.trim() || "Event Playlist",
      // Explicit, not left to the column default (`not null default '{}'`,
      // 0009) — this codebase's established convention (see `createVendor`'s
      // explicit `status: "active"`) of never relying on a schema default
      // actually being applied, since the unit-test fixture and the e2e
      // mock server (neither a real Postgres) do not apply column defaults
      // on insert. Omitting this crashed `EditPlaylistForm`'s
      // `sharedWithRoles.join(",")` against the mock — caught by this
      // phase's own e2e run.
      shared_with_roles: [],
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the playlist.", error);
  return mapPlaylistRow(data);
}
