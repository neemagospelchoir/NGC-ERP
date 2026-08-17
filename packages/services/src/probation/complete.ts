import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import * as members from "../members";
import { mapProbationSummary } from "./map";
import type { ProbationSummary } from "./types";

export interface DecideProbationInput {
  decidedBy: string;
  outcomeNotes?: string | null;
}

/**
 * The "Probation Completed → Converted to Member" leg of PRD §9.1's
 * pipeline: marks the probation record completed, promotes the member out
 * of `probation` into `active` membership, and (if the probation is linked
 * to an application) closes that application out as `converted_to_member`
 * — the final state in the whole onboarding pipeline. Three sequential
 * writes, same documented non-atomicity caveat as
 * members/assign-department.ts and applications/convert.ts.
 */
export async function completeProbation(
  client: SupabaseClient<Database>,
  probationId: string,
  input: DecideProbationInput
): Promise<ProbationSummary> {
  const { data: current, error: loadError } = await client
    .from("probation")
    .select("*")
    .eq("id", probationId)
    .maybeSingle();
  if (loadError) throw new ServiceError("Could not load the probation record.", loadError);
  if (!current) throw new ServiceError("Probation record not found.");
  if (current.status !== "active") {
    throw new ServiceError(`Only an active probation can be completed (currently "${current.status}").`);
  }

  const { data: updated, error } = await client
    .from("probation")
    .update({
      status: "completed",
      decided_by: input.decidedBy,
      decided_at: new Date().toISOString(),
      outcome_notes: input.outcomeNotes ?? null,
    })
    .eq("id", probationId)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not mark the probation completed.", error);

  await members.updateMemberRecord(client, current.member_id, { membershipStatus: "active" });

  if (current.application_id) {
    const { error: appError } = await client
      .from("applications")
      .update({ status: "converted_to_member" })
      .eq("id", current.application_id);
    if (appError) {
      throw new ServiceError(
        "Probation was completed and the member activated, but the linked application's status could not be updated. Please contact support.",
        appError
      );
    }
  }

  const { data: memberRow, error: memberError } = await client
    .from("members")
    .select("id, first_name, last_name, member_number")
    .eq("id", current.member_id)
    .single();
  if (memberError) throw new ServiceError("Could not re-read the member.", memberError);

  return mapProbationSummary(
    updated,
    new Map([[memberRow.id, { name: `${memberRow.first_name} ${memberRow.last_name}`, memberNumber: memberRow.member_number }]])
  );
}
