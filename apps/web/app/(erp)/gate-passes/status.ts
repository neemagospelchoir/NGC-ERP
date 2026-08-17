import type { StatusTone } from "@ngc/ui";
import type { gatePasses } from "@ngc/services";

const GATE_PASS_STATUS_LABEL: Record<gatePasses.GatePassStatus, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  checked_out: "Checked out",
  in_transit: "In transit",
  returned: "Returned",
  partially_returned: "Partially returned",
  damaged: "Damaged",
  lost: "Lost",
};

const GATE_PASS_STATUS_TONE: Record<gatePasses.GatePassStatus, StatusTone> = {
  pending_approval: "warning",
  approved: "good",
  rejected: "critical",
  checked_out: "neutral",
  in_transit: "neutral",
  returned: "good",
  partially_returned: "warning",
  damaged: "critical",
  lost: "critical",
};

export function gatePassStatusLabel(status: gatePasses.GatePassStatus): string {
  return GATE_PASS_STATUS_LABEL[status] ?? status;
}

export function gatePassStatusTone(status: gatePasses.GatePassStatus): StatusTone {
  return GATE_PASS_STATUS_TONE[status] ?? "neutral";
}

const DECISION_LABEL: Record<"approve" | "reject" | "request_changes", string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
};

export const DECISION_OPTIONS = Object.entries(DECISION_LABEL).map(([value, label]) => ({ value, label }));

const RETURN_CONDITION_LABEL: Record<gatePasses.ReturnCondition, string> = {
  good: "Good — fully returned",
  damaged: "Damaged",
  lost: "Lost",
};

export const RETURN_CONDITION_OPTIONS = Object.entries(RETURN_CONDITION_LABEL).map(([value, label]) => ({ value, label }));
