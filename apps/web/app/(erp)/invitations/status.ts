import type { StatusTone } from "@ngc/ui";
import type { invitations } from "@ngc/services";

const INVITATION_STATUS_LABEL: Record<invitations.InvitationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  received: "Received",
  under_review: "Under review",
  pending_information: "Pending information",
  pending_management_approval: "Pending management approval",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  postponed: "Postponed",
};

const INVITATION_STATUS_TONE: Record<invitations.InvitationStatus, StatusTone> = {
  draft: "neutral",
  submitted: "warning",
  received: "warning",
  under_review: "warning",
  pending_information: "serious",
  pending_management_approval: "warning",
  approved: "good",
  declined: "critical",
  cancelled: "neutral",
  completed: "good",
  postponed: "neutral",
};

export function invitationStatusLabel(status: invitations.InvitationStatus): string {
  return INVITATION_STATUS_LABEL[status] ?? status;
}

export function invitationStatusTone(status: invitations.InvitationStatus): StatusTone {
  return INVITATION_STATUS_TONE[status] ?? "neutral";
}

export const INVITATION_STATUS_OPTIONS = Object.entries(INVITATION_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const DECISION_LABEL: Record<"approve" | "reject" | "request_changes", string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
};

export const DECISION_OPTIONS = Object.entries(DECISION_LABEL).map(([value, label]) => ({ value, label }));
