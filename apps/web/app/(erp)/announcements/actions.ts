"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { announcements, auth } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface AnnouncementFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readTargetUserIds(formData: FormData): string[] {
  const raw = String(formData.get("targetUserIds") ?? "");
  return raw
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function createAnnouncementAction(_prevState: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await announcements.createAnnouncement(supabase, {
      title: String(formData.get("title") ?? ""),
      message: String(formData.get("message") ?? ""),
      imageUrl: readOptionalString(formData, "imageUrl"),
      attachmentDocumentId: readOptionalString(formData, "attachmentDocumentId"),
      targetAudience: (String(formData.get("targetAudience") ?? "all") as announcements.TargetAudience) || "all",
      targetDepartmentId: readOptionalString(formData, "targetDepartmentId"),
      targetFamilyId: readOptionalString(formData, "targetFamilyId"),
      targetUserIds: readTargetUserIds(formData),
      priority: (String(formData.get("priority") ?? "normal") as announcements.AnnouncementPriority) || "normal",
      publishAt: readOptionalString(formData, "publishAt") ?? undefined,
      expiryAt: readOptionalString(formData, "expiryAt") ?? undefined,
      authorId: currentUser.id,
    });
  } catch (err) {
    if (err instanceof announcements.ServiceError) return { error: err.message };
    return { error: "Could not create the announcement." };
  }
  revalidatePath("/announcements");
  return {};
}

export async function updateAnnouncementAction(
  id: string,
  _prevState: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  const supabase = await createClient();
  try {
    await announcements.updateAnnouncement(supabase, id, {
      title: String(formData.get("title") ?? ""),
      message: String(formData.get("message") ?? ""),
      imageUrl: readOptionalString(formData, "imageUrl"),
      attachmentDocumentId: readOptionalString(formData, "attachmentDocumentId"),
      targetAudience: (String(formData.get("targetAudience") ?? "all") as announcements.TargetAudience) || "all",
      targetDepartmentId: readOptionalString(formData, "targetDepartmentId"),
      targetFamilyId: readOptionalString(formData, "targetFamilyId"),
      targetUserIds: readTargetUserIds(formData),
      priority: (String(formData.get("priority") ?? "normal") as announcements.AnnouncementPriority) || "normal",
      publishAt: readOptionalString(formData, "publishAt") ?? undefined,
      expiryAt: readOptionalString(formData, "expiryAt") ?? undefined,
    });
  } catch (err) {
    if (err instanceof announcements.ServiceError) return { error: err.message };
    return { error: "Could not update the announcement." };
  }
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return {};
}

/**
 * Redirects back to the list afterward, unlike Procurement's `cancelProcurementRequestAction`
 * (which stays on the same detail page since that row still exists post-cancel) — this row is
 * gone, so staying put would only re-render the detail page into a 404 the next time Next.js
 * re-fetches it, a dead end this avoids by navigating away explicitly.
 */
export async function deleteAnnouncementAction(id: string): Promise<void> {
  const supabase = await createClient();
  await announcements.deleteAnnouncement(supabase, id);
  revalidatePath("/announcements");
  redirect("/announcements");
}
