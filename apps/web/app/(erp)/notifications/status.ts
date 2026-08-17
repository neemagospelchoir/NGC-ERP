import type { StatusTone, SelectOption } from "@ngc/ui";
import type { notifications } from "@ngc/services";

const CHANNEL_LABEL: Record<notifications.NotificationChannel, string> = {
  in_app: "In-app",
  push: "Push",
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export function channelLabel(channel: notifications.NotificationChannel): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

export const CHANNEL_OPTIONS: SelectOption[] = Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label }));

const STATUS_LABEL: Record<notifications.NotificationStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  failed: "Failed",
  read: "Read",
};

const STATUS_TONE: Record<notifications.NotificationStatus, StatusTone> = {
  queued: "neutral",
  sent: "good",
  failed: "critical",
  read: "neutral",
};

export function statusLabel(status: notifications.NotificationStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusTone(status: notifications.NotificationStatus): StatusTone {
  return STATUS_TONE[status] ?? "neutral";
}

/**
 * `event_participants`/`leadership` are absent for the same reason
 * `announcements/status.ts` leaves them out of its own audience picker —
 * see `send.ts`'s own doc comment (10.2) for the full explanation.
 */
const AUDIENCE_LABEL: Record<notifications.NotificationAudience, string> = {
  all: "Every active user",
  department: "A specific department",
  family: "A specific family",
  specific_users: "Specific users (by user ID)",
};

export function audienceLabel(audience: notifications.NotificationAudience): string {
  return AUDIENCE_LABEL[audience] ?? audience;
}

export const AUDIENCE_OPTIONS: SelectOption[] = Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label }));
