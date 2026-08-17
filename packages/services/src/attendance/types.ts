export type SessionType = "rehearsal" | "meeting" | "department_meeting" | "other";

/**
 * `event` is a valid `attendance_sessions.session_type` at the database
 * level (0006/0008) but is deliberately not offered here — Events don't
 * exist yet as a module (Phase 7.5), and event-day attendance has its own
 * dedicated table (`event_attendance`) once that phase builds it. This
 * module only ever creates rehearsal/meeting/department_meeting/other
 * sessions.
 */
export const SESSION_TYPES: SessionType[] = ["rehearsal", "meeting", "department_meeting", "other"];

export interface AttendanceStatusOption {
  code: string;
  label: string;
  countsAsPresent: boolean;
}

export interface AttendanceSessionSummary {
  id: string;
  sessionType: SessionType;
  title: string;
  departmentId: string | null;
  departmentName: string | null;
  sessionDate: string;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateSessionInput {
  sessionType: SessionType;
  title: string;
  /** Null/omitted = a whole-choir session, visible/writable by anyone with `attendance.records.manage` or scoped to no department restriction. */
  departmentId?: string | null;
  sessionDate: string;
  startsAt?: string | null;
  endsAt?: string | null;
  createdBy: string;
}

export interface ListSessionsOptions {
  departmentId?: string;
  from?: string;
  to?: string;
}

/** One roster row: a member eligible/expected for this session, plus their recorded status (if any). */
export interface RosterEntry {
  memberId: string;
  memberName: string;
  memberNumber: string;
  statusCode: string | null;
  notes: string | null;
  recordedVia: string | null;
  recordedAt: string | null;
}

export interface RecordAttendanceInput {
  sessionId: string;
  memberId: string;
  statusCode: string;
  notes?: string | null;
  recordedBy: string;
}

export interface MemberAttendanceSummary {
  memberId: string;
  sessionsPresent: number;
  sessionsRecorded: number;
  /** Null when the member has no recorded attendance at all yet — distinct from 0%, which means recorded-but-always-absent. */
  attendancePercentage: number | null;
}

/**
 * The mobile offline-capture write path (ARCHITECTURE.md S18). See
 * sync-offline.ts's own doc comment for the full retry-safety/conflict
 * contract this powers — `clientIdempotencyKey` is what makes a queued
 * record safe to re-submit after an interrupted sync.
 */
export interface SyncOfflineAttendanceInput {
  sessionId: string;
  memberId: string;
  statusCode: string;
  notes?: string | null;
  recordedBy: string;
  clientIdempotencyKey: string;
}

/** A snapshot of whatever attendance record already exists when a sync call detects a genuine conflict (not this same offline record re-syncing). */
export interface ExistingAttendanceSnapshot {
  statusCode: string;
  notes: string | null;
  recordedVia: string;
  updatedAt: string;
}

export type SyncOfflineAttendanceResult =
  | { outcome: "synced"; recordId: string }
  | { outcome: "already_synced"; recordId: string }
  | { outcome: "conflict"; existing: ExistingAttendanceSnapshot }
  | { outcome: "session_not_found" };
