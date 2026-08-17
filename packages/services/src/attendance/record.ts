import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { RecordAttendanceInput } from "./types";

/**
 * Insert-or-update by the table's own `unique (session_id, member_id)`
 * constraint (0006) — checked-then-written rather than a single
 * `.upsert()` call, consistent with this codebase's existing preference
 * for explicit multi-step writes over relying on a single PostgREST/
 * supabase-js convenience method (see members/assign-department.ts's own
 * "check current, then write" shape). No application-layer permission
 * check — `attendance_write_scoped` RLS (0006) already requires
 * `attendance.records.manage` or that the session's department is in the
 * caller's own scope.
 *
 * `statusCode` is validated against the real, active
 * `lookup_values(category='attendance_status')` codes (Phase 7.3 security
 * review finding) rather than only checked for non-blankness — the
 * `attendance` table itself has no FK/check constraint tying it to
 * `lookup_values` (status is deliberately admin-configurable free text,
 * per spec S25), so without this an already-authorized caller (anyone who
 * holds session-write access) could otherwise persist an arbitrary
 * string. That would silently be treated as "not counting toward
 * present" by `member_attendance_summary`'s left join (no matching
 * `lookup_values` row) while `roster-table.tsx` displays it as though
 * nothing was recorded at all, even though a row exists.
 */
export async function recordAttendance(client: SupabaseClient<Database>, input: RecordAttendanceInput): Promise<void> {
  const statusCode = input.statusCode.trim();
  if (!statusCode) {
    throw new ServiceError("An attendance status is required.");
  }

  const { data: statusRow, error: statusError } = await client
    .from("lookup_values")
    .select("id")
    .eq("category", "attendance_status")
    .eq("code", statusCode)
    .eq("is_active", true)
    .maybeSingle();
  if (statusError) throw new ServiceError("Could not verify the attendance status.", statusError);
  if (!statusRow) {
    throw new ServiceError(`"${statusCode}" is not a recognized attendance status.`);
  }

  const { data: existing, error: existingError } = await client
    .from("attendance")
    .select("id")
    .eq("session_id", input.sessionId)
    .eq("member_id", input.memberId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check existing attendance.", existingError);

  if (existing) {
    const { error } = await client
      .from("attendance")
      .update({
        status_code: statusCode,
        notes: input.notes ?? null,
        recorded_via: "manual",
        recorded_by: input.recordedBy,
      })
      .eq("id", existing.id);
    if (error) throw new ServiceError("Could not update attendance.", error);
    return;
  }

  const { error } = await client.from("attendance").insert({
    session_id: input.sessionId,
    member_id: input.memberId,
    status_code: statusCode,
    notes: input.notes ?? null,
    recorded_via: "manual",
    recorded_by: input.recordedBy,
  });
  if (error) throw new ServiceError("Could not record attendance.", error);
}
