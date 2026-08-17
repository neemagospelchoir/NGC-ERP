import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import * as members from "../members";
import { mapProbationSummary } from "./map";
import type { ProbationSummary } from "./types";
import type { DecideProbationInput } from "./complete";

/**
 * The "Probation Failed" leg. Outcome notes are REQUIRED here (unlike
 * completion) — the master "never destroy historical data, never silently
 * exit someone" rule means a failed probation must record why. Maps to
 * `membership_status = 'exited'` on the member record — the schema's
 * lifecycle enum (probation, active, suspended, potentially_inactive,
 * inactive, exited) has no dedicated "probation_failed" member state, and
 * `exited` (with exit_reason/exited_at set) is the closest faithful fit;
 * this interpretation is flagged in docs/PHASE_7_2.md for confirmation
 * with NGC HR, the same way placeholder system_settings values are
 * flagged elsewhere in this codebase.
 */
export async function failProbation(
  client: SupabaseClient<Database>,
  probationId: string,
  input: DecideProbationInput
): Promise<ProbationSummary> {
  const outcomeNotes = input.outcomeNotes?.trim();
  if (!outcomeNotes) {
    throw new ServiceError("A reason is required when a probation fails.");
  }

  const { data: current, error: loadError } = await client
    .from("probation")
    .select("*")
    .eq("id", probationId)
    .maybeSingle();
  if (loadError) throw new ServiceError("Could not load the probation record.", loadError);
  if (!current) throw new ServiceError("Probation record not found.");
  if (current.status !== "active") {
    throw new ServiceError(`Only an active probation can be marked failed (currently "${current.status}").`);
  }

  const { data: updated, error } = await client
    .from("probation")
    .update({
      status: "failed",
      decided_by: input.decidedBy,
      decided_at: new Date().toISOString(),
      outcome_notes: outcomeNotes,
    })
    .eq("id", probationId)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not mark the probation failed.", error);

  const today = new Date().toISOString().slice(0, 10);
  await members.updateMemberRecord(client, current.member_id, {
    membershipStatus: "exited",
    exitedAt: today,
    exitReason: outcomeNotes,
  });

  if (current.application_id) {
    const { error: appError } = await client
      .from("applications")
      .update({ status: "probation_failed" })
      .eq("id", current.application_id);
    if (appError) {
      throw new ServiceError(
        "Probation was marked failed and the member's record updated, but the linked application's status could not be updated. Please contact support.",
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
