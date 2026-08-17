import type { StatusTone } from "@ngc/ui";
import type { discipline } from "@ngc/services";

const CASE_STATUS_LABEL: Record<discipline.CaseStatus, string> = {
  open: "Open",
  under_investigation: "Under investigation",
  action_decided: "Action decided",
  resolved: "Resolved",
  closed: "Closed",
};

const CASE_STATUS_TONE: Record<discipline.CaseStatus, StatusTone> = {
  open: "warning",
  under_investigation: "warning",
  action_decided: "neutral",
  resolved: "good",
  closed: "neutral",
};

export function caseStatusLabel(status: discipline.CaseStatus): string {
  return CASE_STATUS_LABEL[status] ?? status;
}

export function caseStatusTone(status: discipline.CaseStatus): StatusTone {
  return CASE_STATUS_TONE[status] ?? "neutral";
}

export const CASE_STATUS_OPTIONS = Object.entries(CASE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const ACTION_TYPE_LABEL: Record<discipline.ActionType, string> = {
  warning: "Warning",
  suspension: "Suspension",
  probation_extension: "Probation extension",
  dismissal: "Dismissal",
  other: "Other",
};

export function actionTypeLabel(type: discipline.ActionType): string {
  return ACTION_TYPE_LABEL[type] ?? type;
}

export const ACTION_TYPE_OPTIONS = Object.entries(ACTION_TYPE_LABEL).map(([value, label]) => ({ value, label }));
