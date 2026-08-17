import type { StatusTone } from "@ngc/ui";
import type { events } from "@ngc/services";

const EVENT_STATUS_LABEL: Record<events.EventStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  postponed: "Postponed",
};

const EVENT_STATUS_TONE: Record<events.EventStatus, StatusTone> = {
  scheduled: "warning",
  confirmed: "good",
  completed: "neutral",
  cancelled: "critical",
  postponed: "neutral",
};

export function eventStatusLabel(status: events.EventStatus): string {
  return EVENT_STATUS_LABEL[status] ?? status;
}

export function eventStatusTone(status: events.EventStatus): StatusTone {
  return EVENT_STATUS_TONE[status] ?? "neutral";
}

/** Added for Phase 13.2's Event Report filter dropdown — same `Object.entries(...LABEL)` pattern as CASE_STATUS_OPTIONS/LEAVE_STATUS_OPTIONS. */
export const EVENT_STATUS_OPTIONS = Object.entries(EVENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));
