import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMediaLinkRow } from "./map";
import type { MediaLink, UpdateMediaLinkInput } from "./types";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

/** `media_links_write_media` RLS (0016) already gates every write on `media.links.manage` — no application-layer permission check is duplicated here. */
export async function updateMediaLink(client: SupabaseClient<Database>, id: string, input: UpdateMediaLinkInput): Promise<MediaLink> {
  const patch: Database["public"]["Tables"]["media_links"]["Update"] = {};
  if (input.eventId !== undefined) patch.event_id = input.eventId;
  if (input.linkType !== undefined) patch.link_type = input.linkType;
  if (input.url !== undefined) {
    const url = input.url.trim();
    if (!url) throw new ServiceError("A URL is required.");
    if (!isHttpUrl(url)) throw new ServiceError("The URL must start with http:// or https://.");
    patch.url = url;
  }
  if (input.title !== undefined) patch.title = input.title?.trim() || null;
  if (input.sharedWithRoles !== undefined) patch.shared_with_roles = input.sharedWithRoles;
  if (input.sharedWithDepartmentIds !== undefined) patch.shared_with_department_ids = input.sharedWithDepartmentIds;
  if (input.sharedWithMemberIds !== undefined) patch.shared_with_member_ids = input.sharedWithMemberIds;
  if (input.isPublished !== undefined) patch.is_published = input.isPublished;

  const { data, error } = await client.from("media_links").update(patch).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the media link.", error);
  return mapMediaLinkRow(data);
}

export async function deleteMediaLink(client: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await client.from("media_links").delete().eq("id", id);
  if (error) throw new ServiceError("Could not delete the media link.", error);
}
