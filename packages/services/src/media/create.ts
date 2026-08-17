import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMediaLinkRow } from "./map";
import type { CreateMediaLinkInput, MediaLink } from "./types";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

/**
 * Creates a media link (PRD §7.20) — gated on `media.links.manage` by
 * `media_links_write_media` RLS (0016), held by Media Department and Super
 * Admin per the seed. `eventId` is optional at the schema level (0016) —
 * not every media item (a general press release, for instance) is tied to
 * one specific event.
 */
export async function createMediaLink(client: SupabaseClient<Database>, input: CreateMediaLinkInput): Promise<MediaLink> {
  const url = input.url.trim();
  if (!url) throw new ServiceError("A URL is required.");
  if (!isHttpUrl(url)) throw new ServiceError("The URL must start with http:// or https://.");
  if (!input.createdBy) throw new ServiceError("A creator is required.");

  const { data, error } = await client
    .from("media_links")
    .insert({
      event_id: input.eventId ?? null,
      link_type: input.linkType,
      url,
      title: input.title?.trim() || null,
      shared_with_roles: input.sharedWithRoles ?? [],
      shared_with_department_ids: input.sharedWithDepartmentIds ?? [],
      shared_with_member_ids: input.sharedWithMemberIds ?? [],
      is_published: input.isPublished ?? false,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the media link.", error);
  return mapMediaLinkRow(data);
}
