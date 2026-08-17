import type { Database } from "@ngc/db";
import type { AttendanceSessionSummary, MemberAttendanceSummary, SessionType } from "./types";

type SessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];

export function mapSessionSummary(row: SessionRow, departmentNamesById: Map<string, string>): AttendanceSessionSummary {
  return {
    id: row.id,
    sessionType: row.session_type as SessionType,
    title: row.title,
    departmentId: row.department_id,
    departmentName: row.department_id ? (departmentNamesById.get(row.department_id) ?? null) : null,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * `member_attendance_summary` is a view (0006) computed with `group by
 * m.id`, so every aggregate column is in practice always populated for a
 * row that exists at all — but the generated `Database` type marks view
 * columns nullable across the board (it can't express "aggregate over a
 * guaranteed-present group-by key"), so this defends against that at the
 * type level without pretending the underlying data is actually uncertain.
 */
export function mapMemberAttendanceSummary(row: {
  member_id: string | null;
  sessions_present: number | null;
  sessions_recorded: number | null;
  attendance_percentage: number | null;
}): MemberAttendanceSummary {
  return {
    memberId: row.member_id ?? "",
    sessionsPresent: row.sessions_present ?? 0,
    sessionsRecorded: row.sessions_recorded ?? 0,
    attendancePercentage: row.attendance_percentage,
  };
}
