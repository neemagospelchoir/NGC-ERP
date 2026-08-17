import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapProbationSummary } from "./map";
import type { ProbationSummary } from "./types";

/** Single-record fetch for the detail page — same RLS (`probation_select_scoped`, 0005) as listProbations, just narrowed to one id. */
export async function getProbation(client: SupabaseClient<Database>, id: string): Promise<ProbationSummary | null> {
  const { data, error } = await client.from("probation").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the probation record.", error);
  if (!data) return null;

  const { data: memberRow, error: memberError } = await client
    .from("members")
    .select("id, first_name, last_name, member_number")
    .eq("id", data.member_id)
    .maybeSingle();
  if (memberError) throw new ServiceError("Could not resolve the member.", memberError);

  const memberNamesById = new Map<string, { name: string; memberNumber: string }>();
  if (memberRow) {
    memberNamesById.set(memberRow.id, { name: `${memberRow.first_name} ${memberRow.last_name}`, memberNumber: memberRow.member_number });
  }

  return mapProbationSummary(data, memberNamesById);
}
