import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listSessions } from "../../attendance/sessions";
import { getSessionRoster } from "../../attendance/roster";
import { listAttendanceStatuses } from "../../attendance/statuses";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Attendance Report" (PRD §11/§15 MVP). Deliberately does NOT read
 * `member_attendance_summary` (0006/0025) — that view is a permanent,
 * all-time percentage, with no period dimension at all, so it cannot
 * answer "how did attendance look in March 2026" the way a
 * Monthly/Quarterly/Yearly/Custom report needs to. Instead this composes
 * three already-existing, already-RLS-scoped reads exactly as
 * ARCHITECTURE.md §15 intends ("report queries run against the same
 * RLS-protected tables/views the live UI uses"): `listSessions({from,to})`
 * for the sessions in range, `getSessionRoster` per session (the same
 * function the "take attendance" screen itself reads), and
 * `listAttendanceStatuses` for the admin-configurable "counts as present"
 * flag (mirroring the view's own `counts_as_present` logic so the two
 * definitions of "present" can never silently drift apart from each
 * other, even though this report recomputes it rather than reading the
 * view). A department leader whose session visibility is already scoped
 * by `attendance_sessions_select_scoped` sees exactly those same sessions
 * here — no broader read is introduced by aggregating them into a report.
 */
export async function runAttendanceReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const [sessions, statuses] = await Promise.all([
    listSessions(client, { from, to, departmentId: filters.departmentId }),
    listAttendanceStatuses(client),
  ]);
  const countsAsPresentByCode = new Map(statuses.map((s) => [s.code, s.countsAsPresent]));

  interface Tally {
    memberName: string;
    memberNumber: string;
    sessionsRecorded: number;
    sessionsPresent: number;
  }
  const tallyByMemberId = new Map<string, Tally>();

  const rosters = await Promise.all(sessions.map((session) => getSessionRoster(client, session.id)));
  for (const roster of rosters) {
    for (const entry of roster) {
      if (!entry.statusCode) continue; // not yet marked for this session — not counted either way, same as the view's own "recorded" denominator
      const tally = tallyByMemberId.get(entry.memberId) ?? {
        memberName: entry.memberName,
        memberNumber: entry.memberNumber,
        sessionsRecorded: 0,
        sessionsPresent: 0,
      };
      tally.sessionsRecorded += 1;
      if (countsAsPresentByCode.get(entry.statusCode)) tally.sessionsPresent += 1;
      tallyByMemberId.set(entry.memberId, tally);
    }
  }

  const rows = [...tallyByMemberId.values()]
    .sort((a, b) => a.memberName.localeCompare(b.memberName))
    .map((t) => ({
      memberNumber: t.memberNumber,
      name: t.memberName,
      sessionsInPeriod: sessions.length,
      sessionsRecorded: t.sessionsRecorded,
      sessionsPresent: t.sessionsPresent,
      attendancePercentage: t.sessionsRecorded > 0 ? Math.round((t.sessionsPresent / t.sessionsRecorded) * 1000) / 10 : null,
    }));

  return {
    reportKey: "attendance",
    title: "Attendance Report",
    period: { from, to },
    columns: [
      { key: "memberNumber", label: "Member #" },
      { key: "name", label: "Name" },
      { key: "sessionsInPeriod", label: "Sessions held", align: "right" },
      { key: "sessionsRecorded", label: "Sessions recorded", align: "right" },
      { key: "sessionsPresent", label: "Present", align: "right" },
      { key: "attendancePercentage", label: "Attendance %", align: "right" },
    ],
    rows,
  };
}
