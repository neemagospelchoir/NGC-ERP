import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { AttendanceStatusOption } from "./types";

/**
 * Attendance statuses are admin-configurable data (`lookup_values`,
 * category='attendance_status' — 0003/seed), not a hardcoded enum, per
 * spec S25 "+ Other configurable status". `metadata.counts_as_present`
 * drives both `member_attendance_summary`'s percentage calculation (0006)
 * and this UI's tone/eligibility hints — reading it from the same table
 * the view reads from keeps the two from silently drifting apart.
 */
export async function listAttendanceStatuses(client: SupabaseClient<Database>): Promise<AttendanceStatusOption[]> {
  const { data, error } = await client
    .from("lookup_values")
    .select("*")
    .eq("category", "attendance_status")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new ServiceError("Could not load attendance statuses.", error);

  return (data ?? []).map((row) => ({
    code: row.code,
    label: row.label,
    countsAsPresent: Boolean((row.metadata as Record<string, unknown> | null)?.counts_as_present),
  }));
}
