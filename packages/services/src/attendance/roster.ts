import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { RosterEntry } from "./types";

/**
 * The roster for a session is every member expected to attend it: everyone
 * in the session's department if it's department-scoped, or every
 * non-exited member if it's a whole-choir session (an `exited` member has
 * left the choir entirely — spec's "no automatic deletion" means their
 * historical attendance rows are kept, but they don't appear as an
 * outstanding roster entry to mark going forward). Left-joined (in two flat
 * queries, same rationale as members/resolve-names.ts) against whatever
 * attendance has already been recorded for this session, so a
 * not-yet-marked member still shows up with `statusCode: null` rather than
 * being silently absent from the list.
 */
export async function getSessionRoster(client: SupabaseClient<Database>, sessionId: string): Promise<RosterEntry[]> {
  const { data: session, error: sessionError } = await client
    .from("attendance_sessions")
    .select("id, department_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new ServiceError("Could not load the attendance session.", sessionError);
  if (!session) throw new ServiceError("Attendance session not found.");

  let memberQuery = client
    .from("members")
    .select("id, first_name, last_name, member_number")
    .neq("membership_status", "exited")
    .order("first_name", { ascending: true });
  if (session.department_id) {
    memberQuery = memberQuery.eq("primary_department_id", session.department_id);
  }

  const { data: members, error: membersError } = await memberQuery;
  if (membersError) throw new ServiceError("Could not load the roster's members.", membersError);

  const { data: attendanceRows, error: attendanceError } = await client
    .from("attendance")
    .select("member_id, status_code, notes, recorded_via, created_at")
    .eq("session_id", sessionId);
  if (attendanceError) throw new ServiceError("Could not load recorded attendance.", attendanceError);

  const recordedByMemberId = new Map((attendanceRows ?? []).map((r) => [r.member_id, r]));

  return (members ?? []).map((member) => {
    const recorded = recordedByMemberId.get(member.id);
    return {
      memberId: member.id,
      memberName: `${member.first_name} ${member.last_name}`,
      memberNumber: member.member_number,
      statusCode: recorded?.status_code ?? null,
      notes: recorded?.notes ?? null,
      recordedVia: recorded?.recorded_via ?? null,
      recordedAt: recorded?.created_at ?? null,
    };
  });
}
