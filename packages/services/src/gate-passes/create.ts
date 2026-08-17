import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapGatePassRow } from "./map";
import type { CreateGatePassInput, GatePass } from "./types";

const GATE_PASS_NUMBER_SEQUENCE_KEY = "gate_pass_number";
const GATE_PASS_NUMBER_SETTING_KEY = "id_format.gate_pass_number";
/** Only used if system_settings is somehow missing the row every seed applies — see createAsset's identical fallback rationale (docs/PHASE_8_1.md). */
const FALLBACK_GATE_PASS_NUMBER_FORMAT = "GP-{year}-{sequence}";

/**
 * Creates a gate pass shell (PRD §7.6) — event, responsible person,
 * department, expected departure/return — with `status: 'pending_approval'`
 * and no items yet. Mirrors `createAsset`/`createMember`'s organization-
 * configurable ID generation exactly: reads `system_settings.id_format.
 * gate_pass_number` (already seeded since Phase 4, unlike `asset_tag`,
 * which Phase 8.1 had to add) and passes it to `next_formatted_id()`.
 *
 * Line items are added separately via `add-item.ts`'s `addGatePassItem`,
 * which is where the actual equipment-to-event assignment (and its
 * availability/double-booking checks) happens — see that file's doc
 * comment. This function alone does not yet represent "equipment assigned
 * to an event," only the gate pass record that will carry that manifest.
 */
export async function createGatePass(client: SupabaseClient<Database>, input: CreateGatePassInput): Promise<GatePass> {
  if (!input.eventId) throw new ServiceError("An event is required.");
  if (!input.personResponsibleId) throw new ServiceError("A person responsible is required.");

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", GATE_PASS_NUMBER_SETTING_KEY)
    .maybeSingle();
  if (formatError) throw new ServiceError("Could not resolve the gate pass number format.", formatError);
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_GATE_PASS_NUMBER_FORMAT;

  const { data: gatePassNumber, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: GATE_PASS_NUMBER_SEQUENCE_KEY,
    p_format: format,
  });
  if (rpcError || !gatePassNumber) throw new ServiceError("Could not generate a gate pass number.", rpcError);

  const { data, error } = await client
    .from("gate_passes")
    .insert({
      gate_pass_number: gatePassNumber,
      event_id: input.eventId,
      person_responsible_id: input.personResponsibleId,
      department_id: input.departmentId ?? null,
      expected_departure: input.expectedDeparture ?? null,
      expected_return: input.expectedReturn ?? null,
      status: "pending_approval",
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not create the gate pass.", error);
  return mapGatePassRow(data);
}
