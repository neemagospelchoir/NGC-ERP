import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAnnouncementRow } from "./map";
import type { Announcement, UpdateAnnouncementInput } from "./types";

/** Updates an announcement in place — gated on `communications.announcements.manage` by `announcements_write_scoped` RLS (0016), same as create. */
export async function updateAnnouncement(client: SupabaseClient<Database>, id: string, input: UpdateAnnouncementInput): Promise<Announcement> {
  const title = input.title.trim();
  if (!title) throw new ServiceError("A title is required.");
  const message = input.message.trim();
  if (!message) throw new ServiceError("A message is required.");

  const { data, error } = await client
    .from("announcements")
    .update({
      title,
      message,
      image_url: input.imageUrl ?? null,
      attachment_document_id: input.attachmentDocumentId ?? null,
      target_audience: input.targetAudience ?? "all",
      target_department_id: input.targetDepartmentId ?? null,
      target_family_id: input.targetFamilyId ?? null,
      target_event_id: input.targetEventId ?? null,
      target_user_ids: input.targetUserIds ?? [],
      priority: input.priority ?? "normal",
      publish_at: input.publishAt ?? new Date().toISOString(),
      expiry_at: input.expiryAt ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not update the announcement.", error);
  return mapAnnouncementRow(data);
}

/**
 * Hard-deletes an announcement — PRD §6's Permission Matrix names "CRUD"
 * for Super Admin, and unlike, say, Assets (where disposal is intentionally
 * non-destructive, PRD §7.18) or Contributions/Expenses (which have a
 * terminal `status` instead), nothing in PRD §7.22 describes announcements
 * as needing a retained audit trail of deleted rows — a mis-published or
 * outdated announcement is exactly the kind of record PRD expects an
 * admin to be able to remove outright, not merely close/cancel. Mirrors
 * `removePlaylistItem` (8.4), this codebase's first real hard-delete.
 */
export async function deleteAnnouncement(client: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await client.from("announcements").delete().eq("id", id);
  if (error) throw new ServiceError("Could not delete the announcement.", error);
}
