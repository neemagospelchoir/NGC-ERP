import type { Database } from "@ngc/db";
import type { Announcement, AnnouncementPriority, TargetAudience } from "./types";

type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];

export function mapAnnouncementRow(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url,
    attachmentDocumentId: row.attachment_document_id,
    targetAudience: row.target_audience as TargetAudience,
    targetDepartmentId: row.target_department_id,
    targetFamilyId: row.target_family_id,
    targetEventId: row.target_event_id,
    targetUserIds: row.target_user_ids,
    priority: row.priority as AnnouncementPriority,
    publishAt: row.publish_at,
    expiryAt: row.expiry_at,
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
