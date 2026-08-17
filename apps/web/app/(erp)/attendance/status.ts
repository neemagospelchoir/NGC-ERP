import type { StatusTone } from "@ngc/ui";

/**
 * Attendance status codes are admin-configurable data (`lookup_values`),
 * not a fixed enum (see packages/services/src/attendance/statuses.ts) —
 * so, unlike Applications'/Probation's fixed-union status maps, tone here
 * is derived at render time from whatever `AttendanceStatusOption` the
 * session's roster/status list actually returned, with a small set of
 * known-code overrides for the statuses this codebase ships seeded
 * (present/late/absent/excused/emergency_leave/approved_leave) so they
 * read distinctly at a glance; any future custom code an admin adds falls
 * back to a countsAsPresent-driven tone rather than looking unstyled.
 */
const KNOWN_CODE_TONE: Record<string, StatusTone> = {
  present: "good",
  late: "warning",
  absent: "critical",
  excused: "neutral",
  emergency_leave: "warning",
  approved_leave: "neutral",
};

export function attendanceStatusTone(code: string, countsAsPresent: boolean): StatusTone {
  return KNOWN_CODE_TONE[code] ?? (countsAsPresent ? "good" : "neutral");
}

export const SESSION_TYPE_LABEL: Record<string, string> = {
  rehearsal: "Rehearsal",
  meeting: "Meeting",
  department_meeting: "Department meeting",
  other: "Other",
};

export function sessionTypeLabel(type: string): string {
  return SESSION_TYPE_LABEL[type] ?? type;
}
