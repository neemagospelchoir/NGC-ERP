import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAnnouncementRow } from "./map";
import type { Announcement, CreateAnnouncementInput } from "./types";

/**
 * Creates an announcement (PRD §7.22) — gated on `communications.
 * announcements.manage` by `announcements_write_scoped` RLS (0016), held by
 * Super Admin, HR/Deputy Secretary, and PRO/Spokesperson per the seed.
 * `publishAt` defaults to "now" (immediate) if omitted, but a caller may
 * schedule it for later — 0032's RLS widening (see that migration's own
 * doc comment) is what makes it possible for the author to read the row
 * back before that date arrives, since the original policy only ever let
 * anyone see a row once it went live.
 */
export async function createAnnouncement(client: SupabaseClient<Database>, input: CreateAnnouncementInput): Promise<Announcement> {
  const title = input.title.trim();
  if (!title) throw new ServiceError("A title is required.");
  const message = input.message.trim();
  if (!message) throw new ServiceError("A message is required.");
  if (!input.authorId) throw new ServiceError("An author is required.");

  const { data, error } = await client
    .from("announcements")
    .insert({
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
      author_id: input.authorId,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the announcement.", error);
  return mapAnnouncementRow(data);
}
