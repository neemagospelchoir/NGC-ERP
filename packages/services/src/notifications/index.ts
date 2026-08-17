export { listNotificationTemplates, getNotificationTemplate, createNotificationTemplate, updateNotificationTemplate } from "./templates";
export { sendNotification } from "./send";
export { listMyNotifications, markNotificationRead } from "./list";

export type {
  CreateNotificationTemplateInput,
  Notification,
  NotificationAudience,
  NotificationChannel,
  NotificationStatus,
  NotificationTemplate,
  SendNotificationInput,
  SendNotificationResult,
  UpdateNotificationTemplateInput,
} from "./types";

export { ServiceError } from "../shared/errors";
