import type { StatusTone } from "@ngc/ui";

/** Maps the membership_status lifecycle (spec: probation → active → suspended/potentially_inactive/inactive → exited) to a status pill tone. Centralized here so the list page and detail page never drift apart on what each status means visually. */
export const MEMBERSHIP_STATUS_TONE: Record<string, StatusTone> = {
  probation: "neutral",
  active: "good",
  suspended: "serious",
  potentially_inactive: "warning",
  inactive: "neutral",
  exited: "critical",
};

export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  probation: "Probation",
  active: "Active",
  suspended: "Suspended",
  potentially_inactive: "Potentially inactive",
  inactive: "Inactive",
  exited: "Exited",
};

export function membershipStatusTone(status: string): StatusTone {
  return MEMBERSHIP_STATUS_TONE[status] ?? "neutral";
}

export function membershipStatusLabel(status: string): string {
  return MEMBERSHIP_STATUS_LABEL[status] ?? status;
}

export const MEMBERSHIP_STATUS_OPTIONS = Object.entries(MEMBERSHIP_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
