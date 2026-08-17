import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapProbationSummary } from "./map";
import type { ProbationStatus, ProbationSummary } from "./types";

export interface ListProbationsOptions {
  status?: ProbationStatus;
}

/**
 * `probation_select_scoped` RLS (0004... actually 0005) already limits
 * results to: the member's own probation (if the caller is that member),
 * anyone holding `members.applications.read`, or the probation's own
 * `responsible_leader_id`. Same flat-query name-resolution pattern as
 * members/resolve-names.ts, for the same reason (no embedded-select
 * relationship metadata on the hand-generated Database type).
 */
export async function listProbations(
  client: SupabaseClient<Database>,
  options: ListProbationsOptions = {}
): Promise<ProbationSummary[]> {
  let query = client.from("probation").select("*").order("deadline", { ascending: true });
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load probation records.", error);

  const rows = data ?? [];
  const memberIds = [...new Set(rows.map((r) => r.member_id))];
  const memberNamesById = new Map<string, { name: string; memberNumber: string }>();

  if (memberIds.length > 0) {
    const { data: memberRows, error: memberError } = await client
      .from("members")
      .select("id, first_name, last_name, member_number")
      .in("id", memberIds);
    if (memberError) throw new ServiceError("Could not resolve member names.", memberError);
    for (const m of memberRows ?? []) {
      memberNamesById.set(m.id, { name: `${m.first_name} ${m.last_name}`, memberNumber: m.member_number });
    }
  }

  return rows.map((row) => mapProbationSummary(row, memberNamesById));
}
