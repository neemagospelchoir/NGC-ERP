import type { StatusTone, SelectOption } from "@ngc/ui";
import type { announcements } from "@ngc/services";

const PRIORITY_LABEL: Record<announcements.AnnouncementPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_TONE: Record<announcements.AnnouncementPriority, StatusTone> = {
  low: "neutral",
  normal: "neutral",
  high: "warning",
  urgent: "critical",
};

export function priorityLabel(priority: announcements.AnnouncementPriority): string {
  return PRIORITY_LABEL[priority] ?? priority;
}

export function priorityTone(priority: announcements.AnnouncementPriority): StatusTone {
  return PRIORITY_TONE[priority] ?? "neutral";
}

export const PRIORITY_OPTIONS: SelectOption[] = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }));

/**
 * `event_participants`/`leadership` are deliberately excluded from this
 * option list — see docs/PHASE_10_1.md §2.2 for why those two
 * `target_audience` enum values have no resolvable membership in this
 * codebase today and are left unselectable rather than silently accepted
 * and then meaning nothing.
 */
const TARGET_AUDIENCE_LABEL: Record<string, string> = {
  all: "Everyone",
  department: "A specific department",
  family: "A specific family",
  specific_users: "Specific members (by user ID)",
};

export function targetAudienceLabel(audience: string): string {
  return TARGET_AUDIENCE_LABEL[audience] ?? audience;
}

export const TARGET_AUDIENCE_OPTIONS: SelectOption[] = Object.entries(TARGET_AUDIENCE_LABEL).map(([value, label]) => ({ value, label }));
