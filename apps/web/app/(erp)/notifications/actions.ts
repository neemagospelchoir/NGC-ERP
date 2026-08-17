"use server";

import { revalidatePath } from "next/cache";
import { notifications } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface NotificationFormState {
  error?: string;
  recipientCount?: number;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readUserIds(formData: FormData): string[] {
  const raw = String(formData.get("userIds") ?? "");
  return raw
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function sendNotificationAction(_prevState: NotificationFormState, formData: FormData): Promise<NotificationFormState> {
  const supabase = await createClient();
  try {
    const result = await notifications.sendNotification(supabase, {
      templateId: readOptionalString(formData, "templateId"),
      channel: (String(formData.get("channel") ?? "in_app") as notifications.NotificationChannel) || "in_app",
      subject: readOptionalString(formData, "subject"),
      body: String(formData.get("body") ?? ""),
      audience: (String(formData.get("audience") ?? "all") as notifications.NotificationAudience) || "all",
      departmentId: readOptionalString(formData, "departmentId"),
      familyId: readOptionalString(formData, "familyId"),
      userIds: readUserIds(formData),
    });
    revalidatePath("/notifications");
    return { recipientCount: result.recipientCount };
  } catch (err) {
    if (err instanceof notifications.ServiceError) return { error: err.message };
    return { error: "Could not send the notification." };
  }
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await notifications.markNotificationRead(supabase, id);
  revalidatePath("/notifications");
}

export interface TemplateFormState {
  error?: string;
}

export async function createTemplateAction(_prevState: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const supabase = await createClient();
  try {
    await notifications.createNotificationTemplate(supabase, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      channelSubject: readOptionalString(formData, "channelSubject"),
      bodyTemplate: String(formData.get("bodyTemplate") ?? ""),
      defaultChannels: [(String(formData.get("defaultChannel") ?? "in_app") as notifications.NotificationChannel) || "in_app"],
    });
  } catch (err) {
    if (err instanceof notifications.ServiceError) return { error: err.message };
    return { error: "Could not create the template." };
  }
  revalidatePath("/notifications/templates");
  return {};
}

export async function updateTemplateAction(id: string, _prevState: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const supabase = await createClient();
  try {
    await notifications.updateNotificationTemplate(supabase, id, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      channelSubject: readOptionalString(formData, "channelSubject"),
      bodyTemplate: String(formData.get("bodyTemplate") ?? ""),
      defaultChannels: [(String(formData.get("defaultChannel") ?? "in_app") as notifications.NotificationChannel) || "in_app"],
      isActive: formData.get("isActive") === "on",
    });
  } catch (err) {
    if (err instanceof notifications.ServiceError) return { error: err.message };
    return { error: "Could not update the template." };
  }
  revalidatePath("/notifications/templates");
  revalidatePath(`/notifications/templates/${id}`);
  return {};
}
