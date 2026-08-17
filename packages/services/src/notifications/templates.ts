import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapTemplateRow } from "./map";
import type { CreateNotificationTemplateInput, NotificationTemplate, UpdateNotificationTemplateInput } from "./types";

export interface ListTemplatesOptions {
  includeInactive?: boolean;
}

/** `notification_templates_read_authenticated` RLS (0016) lets any signed-in user read every template — matching how a "rehearsal reminder" template's existence is not itself sensitive. */
export async function listNotificationTemplates(
  client: SupabaseClient<Database>,
  options: ListTemplatesOptions = {}
): Promise<NotificationTemplate[]> {
  let query = client.from("notification_templates").select("*").order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load notification templates.", error);
  return (data ?? []).map(mapTemplateRow);
}

export async function getNotificationTemplate(client: SupabaseClient<Database>, id: string): Promise<NotificationTemplate | null> {
  const { data, error } = await client.from("notification_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the notification template.", error);
  return data ? mapTemplateRow(data) : null;
}

function normalizeInput(input: CreateNotificationTemplateInput) {
  const code = input.code.trim();
  if (!code) throw new ServiceError("A template code is required.");
  const name = input.name.trim();
  if (!name) throw new ServiceError("A template name is required.");
  const bodyTemplate = input.bodyTemplate.trim();
  if (!bodyTemplate) throw new ServiceError("A body template is required.");
  return {
    code,
    name,
    channel_subject: input.channelSubject?.trim() || null,
    body_template: bodyTemplate,
    default_channels: input.defaultChannels ?? ["in_app"],
    is_active: input.isActive ?? true,
  };
}

/** Gated on `communications.templates.manage` by `notification_templates_write_admin` RLS (0016) — Super Admin and PRO/Spokesperson per the seed. */
export async function createNotificationTemplate(
  client: SupabaseClient<Database>,
  input: CreateNotificationTemplateInput
): Promise<NotificationTemplate> {
  const { data, error } = await client.from("notification_templates").insert(normalizeInput(input)).select("*").single();
  if (error) throw new ServiceError("Could not create the notification template.", error);
  return mapTemplateRow(data);
}

export async function updateNotificationTemplate(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateNotificationTemplateInput
): Promise<NotificationTemplate> {
  const { data, error } = await client.from("notification_templates").update(normalizeInput(input)).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the notification template.", error);
  return mapTemplateRow(data);
}
