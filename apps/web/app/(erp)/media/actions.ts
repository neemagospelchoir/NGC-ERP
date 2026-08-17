"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, media } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface MediaFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readIdList(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? "")
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function createMediaLinkAction(_prevState: MediaFormState, formData: FormData): Promise<MediaFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    if (!currentUser) throw new media.ServiceError("You must be signed in.");
    await media.createMediaLink(supabase, {
      linkType: String(formData.get("linkType") ?? "other") as media.MediaLinkType,
      url: String(formData.get("url") ?? ""),
      title: readOptionalString(formData, "title"),
      eventId: readOptionalString(formData, "eventId"),
      sharedWithRoles: readIdList(formData, "sharedWithRoles"),
      sharedWithDepartmentIds: readIdList(formData, "sharedWithDepartmentIds"),
      sharedWithMemberIds: readIdList(formData, "sharedWithMemberIds"),
      isPublished: formData.get("isPublished") === "on",
      // Acting-user id is always resolved server-side, never taken from the
      // form — same convention as createAnnouncementAction/createAgendaAction.
      createdBy: currentUser.id,
    });
  } catch (err) {
    if (err instanceof media.ServiceError) return { error: err.message };
    return { error: "Could not create the media link." };
  }
  revalidatePath("/media");
  return {};
}

export async function updateMediaLinkAction(id: string, _prevState: MediaFormState, formData: FormData): Promise<MediaFormState> {
  const supabase = await createClient();
  try {
    await media.updateMediaLink(supabase, id, {
      linkType: String(formData.get("linkType") ?? "other") as media.MediaLinkType,
      url: String(formData.get("url") ?? ""),
      title: readOptionalString(formData, "title"),
      eventId: readOptionalString(formData, "eventId"),
      sharedWithRoles: readIdList(formData, "sharedWithRoles"),
      sharedWithDepartmentIds: readIdList(formData, "sharedWithDepartmentIds"),
      sharedWithMemberIds: readIdList(formData, "sharedWithMemberIds"),
      isPublished: formData.get("isPublished") === "on",
    });
  } catch (err) {
    if (err instanceof media.ServiceError) return { error: err.message };
    return { error: "Could not update the media link." };
  }
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  return {};
}

export async function deleteMediaLinkAction(id: string): Promise<void> {
  const supabase = await createClient();
  await media.deleteMediaLink(supabase, id);
  revalidatePath("/media");
  redirect("/media");
}
