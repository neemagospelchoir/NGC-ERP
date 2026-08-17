export type NotificationChannel = "in_app" | "push" | "email" | "sms" | "whatsapp";
export type NotificationStatus = "queued" | "sent" | "failed" | "read";

/**
 * `event_participants`/`leadership`/`family` audiences from Announcements'
 * own `target_audience` enum are NOT all reused here — see `send.ts`'s own
 * doc comment for exactly which audiences this composer can resolve to a
 * concrete recipient list today, and why the others are left out rather
 * than accepted-and-silently-ignored.
 */
export type NotificationAudience = "all" | "department" | "family" | "specific_users";

export interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  channelSubject: string | null;
  bodyTemplate: string;
  defaultChannels: NotificationChannel[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationTemplateInput {
  code: string;
  name: string;
  channelSubject?: string | null;
  bodyTemplate: string;
  defaultChannels?: NotificationChannel[];
  isActive?: boolean;
}

export type UpdateNotificationTemplateInput = CreateNotificationTemplateInput;

export interface Notification {
  id: string;
  recipientUserId: string;
  templateId: string | null;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  triggeringEvent: string | null;
  triggeringRecordType: string | null;
  triggeringRecordId: string | null;
  status: NotificationStatus;
  sentAt: string | null;
  readAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface SendNotificationInput {
  templateId?: string | null;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  audience: NotificationAudience;
  departmentId?: string | null;
  familyId?: string | null;
  userIds?: string[];
  triggeringEvent?: string | null;
  triggeringRecordType?: string | null;
  triggeringRecordId?: string | null;
}

export interface SendNotificationResult {
  recipientCount: number;
  notifications: Notification[];
}
