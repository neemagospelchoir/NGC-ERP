import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMediaLinkRow } from "./map";
import type { ListMediaLinksOptions, MediaLink } from "./types";

/**
 * `media_links_select_scoped` RLS (0016, widened by 0035) already scopes
 * results to: any published row (public, no session required — see 0035's
 * own doc comment for why), any `media.links.manage` holder reading
 * everything, or a caller matched by the row's own `shared_with_roles`/
 * `shared_with_department_ids`/`shared_with_member_ids` — no application-
 * layer filtering is duplicated here, the same "trust Postgres" pattern
 * used everywhere else in this codebase.
 */
export async function listMediaLinks(client: SupabaseClient<Database>, options: ListMediaLinksOptions = {}): Promise<MediaLink[]> {
  let query = client.from("media_links").select("*").order("created_at", { ascending: false });
  if (options.eventId) query = query.eq("event_id", options.eventId);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load media links.", error);
  return (data ?? []).map(mapMediaLinkRow);
}

export async function getMediaLink(client: SupabaseClient<Database>, id: string): Promise<MediaLink | null> {
  const { data, error } = await client.from("media_links").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the media link.", error);
  return data ? mapMediaLinkRow(data) : null;
}
