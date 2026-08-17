import type { Database } from "@ngc/db";
import type { MediaLink, MediaLinkType } from "./types";

type MediaLinkRow = Database["public"]["Tables"]["media_links"]["Row"];

export function mapMediaLinkRow(row: MediaLinkRow): MediaLink {
  return {
    id: row.id,
    eventId: row.event_id,
    linkType: row.link_type as MediaLinkType,
    url: row.url,
    title: row.title,
    sharedWithRoles: row.shared_with_roles ?? [],
    sharedWithDepartmentIds: row.shared_with_department_ids ?? [],
    sharedWithMemberIds: row.shared_with_member_ids ?? [],
    isPublished: row.is_published,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
