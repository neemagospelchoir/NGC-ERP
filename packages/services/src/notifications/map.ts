import type { Database } from "@ngc/db";
import type { Notification, NotificationChannel, NotificationStatus, NotificationTemplate } from "./types";

type TemplateRow = Database["public"]["Tables"]["notification_templates"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export function mapTemplateRow(row: TemplateRow): NotificationTemplate {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    channelSubject: row.channel_subject,
    bodyTemplate: row.body_template,
    defaultChannels: row.default_channels as NotificationChannel[],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    templateId: row.template_id,
    channel: row.channel as NotificationChannel,
    subject: row.subject,
    body: row.body,
    triggeringEvent: row.triggering_event,
    triggeringRecordType: row.triggering_record_type,
    triggeringRecordId: row.triggering_record_id,
    status: row.status as NotificationStatus,
    sentAt: row.sent_at,
    readAt: row.read_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}
