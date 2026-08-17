export { createSession, listSessions, getSession } from "./sessions";
export type { CreateSessionInput, ListSessionsOptions } from "./types";

export { listAttendanceStatuses } from "./statuses";

export { getSessionRoster } from "./roster";

export { recordAttendance } from "./record";
export type { RecordAttendanceInput } from "./types";

export { getMemberAttendanceSummary } from "./summary";

export { syncOfflineAttendance } from "./sync-offline";
export type { SyncOfflineAttendanceInput, SyncOfflineAttendanceResult, ExistingAttendanceSnapshot } from "./types";

export type {
  SessionType,
  AttendanceStatusOption,
  AttendanceSessionSummary,
  RosterEntry,
  MemberAttendanceSummary,
} from "./types";
export { SESSION_TYPES } from "./types";

export { ServiceError } from "../shared/errors";
