import type { StatusTone } from "@ngc/ui";
import type { probation } from "@ngc/services";

const PROBATION_STATUS_LABEL: Record<probation.ProbationStatus, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  extended: "Extended",
};

const PROBATION_STATUS_TONE: Record<probation.ProbationStatus, StatusTone> = {
  active: "neutral",
  completed: "good",
  failed: "critical",
  extended: "warning",
};

export function probationStatusLabel(status: probation.ProbationStatus): string {
  return PROBATION_STATUS_LABEL[status] ?? status;
}

export function probationStatusTone(status: probation.ProbationStatus): StatusTone {
  return PROBATION_STATUS_TONE[status] ?? "neutral";
}

export const PROBATION_STATUS_OPTIONS = Object.entries(PROBATION_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
