import type { StatusTone } from "@ngc/ui";
import type { leave } from "@ngc/services";

const LEAVE_STATUS_LABEL: Record<leave.LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const LEAVE_STATUS_TONE: Record<leave.LeaveStatus, StatusTone> = {
  pending: "warning",
  approved: "good",
  rejected: "critical",
  cancelled: "neutral",
};

export function leaveStatusLabel(status: leave.LeaveStatus): string {
  return LEAVE_STATUS_LABEL[status] ?? status;
}

export function leaveStatusTone(status: leave.LeaveStatus): StatusTone {
  return LEAVE_STATUS_TONE[status] ?? "neutral";
}

export const LEAVE_STATUS_OPTIONS = Object.entries(LEAVE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const LEAVE_TYPE_LABEL: Record<leave.LeaveType, string> = {
  emergency: "Emergency",
  planned: "Planned",
  absence_explanation: "Absence explanation",
  other: "Other",
};

export function leaveTypeLabel(type: leave.LeaveType): string {
  return LEAVE_TYPE_LABEL[type] ?? type;
}

export const LEAVE_TYPE_OPTIONS = Object.entries(LEAVE_TYPE_LABEL).map(([value, label]) => ({ value, label }));
