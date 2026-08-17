import type { StatusTone } from "@ngc/ui";
import type { applications } from "@ngc/services";

export const APPLICATION_STATUS_LABEL: Record<applications.ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  incomplete: "Incomplete",
  pending_review: "Pending review",
  under_verification: "Under verification",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  probation: "Probation",
  probation_completed: "Probation completed",
  probation_failed: "Probation failed",
  converted_to_member: "Converted to member",
};

const APPLICATION_STATUS_TONE: Record<applications.ApplicationStatus, StatusTone> = {
  draft: "neutral",
  submitted: "neutral",
  incomplete: "warning",
  pending_review: "neutral",
  under_verification: "neutral",
  pending_approval: "warning",
  approved: "good",
  rejected: "critical",
  cancelled: "neutral",
  probation: "good",
  probation_completed: "good",
  probation_failed: "critical",
  converted_to_member: "good",
};

export function applicationStatusLabel(status: applications.ApplicationStatus): string {
  return APPLICATION_STATUS_LABEL[status] ?? status;
}

export function applicationStatusTone(status: applications.ApplicationStatus): StatusTone {
  return APPLICATION_STATUS_TONE[status] ?? "neutral";
}

export const APPLICATION_STATUS_OPTIONS = Object.entries(APPLICATION_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
