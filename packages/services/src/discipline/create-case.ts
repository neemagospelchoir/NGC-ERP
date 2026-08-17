import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { findMemberByNumber } from "./find-member";
import { mapCaseSummary } from "./map";
import type { CaseSummary, CreateCaseInput } from "./types";

const CASE_NUMBER_SEQUENCE_KEY = "disciplinary_case";
const CASE_NUMBER_SETTING_KEY = "id_format.disciplinary_case_number";
const FALLBACK_CASE_NUMBER_FORMAT = "DISC-{year}-{sequence}";

/**
 * Opens a new disciplinary case (PRD §9.4: "Authorized officer → Incident/
 * Case created"). Takes a member NUMBER, not a member id, and resolves it
 * via findMemberByNumber() — the caller (a Discipline Manager) has no
 * general way to browse/search members, only an exact-number lookup (see
 * find-member.ts's doc comment), which is realistic: they're filing a case
 * about a specific, already-identified incident, not picking from a list.
 *
 * `evidence_document_ids` (0007) is deliberately not accepted here — no
 * Supabase Storage / documents module exists in this codebase yet (same
 * deferral as Phase 7.2's application document uploads), so there is
 * nothing to attach yet.
 */
export async function createCase(client: SupabaseClient<Database>, input: CreateCaseInput): Promise<CaseSummary> {
  const description = input.description.trim();
  if (!description) {
    throw new ServiceError("A description of the incident is required.");
  }
  const category = input.category.trim();
  if (!category) {
    throw new ServiceError("A category is required.");
  }
  if (!input.incidentDate) {
    throw new ServiceError("An incident date is required.");
  }

  const member = await findMemberByNumber(client, input.memberNumber);

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", CASE_NUMBER_SETTING_KEY)
    .maybeSingle();
  if (formatError) throw new ServiceError("Could not resolve the case number format.", formatError);
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_CASE_NUMBER_FORMAT;

  const { data: caseNumber, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: CASE_NUMBER_SEQUENCE_KEY,
    p_format: format,
  });
  if (rpcError || !caseNumber) throw new ServiceError("Could not generate a case number.", rpcError);

  const { data, error } = await client
    .from("disciplinary_cases")
    .insert({
      case_number: caseNumber,
      member_id: member.id,
      category,
      incident_date: input.incidentDate,
      description,
      officer_id: input.officerId,
      // Explicit rather than relying on the DB column default (0007's
      // `default 'open'`) — same "don't trust an untested default"
      // convention as createLeaveRequest()'s explicit status: "pending".
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the disciplinary case.", error);

  return mapCaseSummary(data, new Map([[member.id, { name: `${member.firstName} ${member.lastName}`, memberNumber: member.memberNumber }]]));
}
