import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMemberAttendanceSummary } from "./map";
import type { MemberAttendanceSummary } from "./types";

/**
 * Reads the `member_attendance_summary` view (0006) rather than
 * recomputing anything in the application layer — the view is the single
 * source of truth for "what counts as present," driven by
 * `lookup_values.metadata.counts_as_present`, so this function and the
 * eligibility-threshold check in a future phase can never drift apart on
 * the definition.
 *
 * By default a Postgres view runs with the VIEW OWNER's privileges, not
 * the querying role's — so RLS on `attendance`/`members` would otherwise
 * be silently bypassed for every caller, not enforced by it. This view is
 * explicitly declared `security_invoker = true` (0025, added after a
 * Phase 7.3 security review caught this) specifically so it evaluates
 * under the caller's own role and therefore under `attendance_select_scoped`
 * / `members_select_scoped`, exactly as if this query read the base
 * tables directly. Do not drop that setting without re-checking this.
 */
export async function getMemberAttendanceSummary(
  client: SupabaseClient<Database>,
  memberId: string
): Promise<MemberAttendanceSummary> {
  const { data, error } = await client
    .from("member_attendance_summary")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw new ServiceError("Could not load the member's attendance summary.", error);

  if (!data) {
    return { memberId, sessionsPresent: 0, sessionsRecorded: 0, attendancePercentage: null };
  }
  return mapMemberAttendanceSummary(data);
}
