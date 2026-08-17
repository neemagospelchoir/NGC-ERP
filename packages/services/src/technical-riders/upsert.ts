import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapTechnicalRiderRow } from "./map";
import type { TechnicalRider, UpsertTechnicalRiderInput } from "./types";

/**
 * `technical_riders.event_id` is `unique` (0009) — one rider per event.
 * Insert-or-update by checking for an existing row first, the same
 * check-then-write shape as `recordAttendance` (Phase 7.3), rather than a
 * single `.upsert()` call — this codebase's established preference for
 * explicit multi-step writes over a convenience method whose conflict
 * target/merge behavior is easy to get subtly wrong.
 *
 * No application-layer permission check is duplicated here —
 * `technical_riders_write_technical` RLS (0009) already requires
 * `technical.riders.manage` on both the INSERT and the UPDATE path.
 */
export async function upsertTechnicalRider(
  client: SupabaseClient<Database>,
  input: UpsertTechnicalRiderInput
): Promise<TechnicalRider> {
  if (!input.eventId) throw new ServiceError("An event is required.");

  const { data: existing, error: existingError } = await client
    .from("technical_riders")
    .select("id")
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check for an existing technical rider.", existingError);

  const fields = {
    pa_requirements: input.paRequirements ?? null,
    lighting_requirements: input.lightingRequirements ?? null,
    led_display_requirements: input.ledDisplayRequirements ?? null,
    camera_requirements: input.cameraRequirements ?? null,
    recording_requirements: input.recordingRequirements ?? null,
    power_requirements: input.powerRequirements ?? null,
    stage_requirements: input.stageRequirements ?? null,
    monitoring_requirements: input.monitoringRequirements ?? null,
    crew_notes: input.crewNotes ?? null,
    setup_time: input.setupTime ?? null,
    soundcheck_time: input.soundcheckTime ?? null,
    technical_notes: input.technicalNotes ?? null,
    prepared_by: input.preparedBy ?? null,
  };

  if (existing) {
    const { data, error } = await client
      .from("technical_riders")
      .update(fields)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new ServiceError("Could not update the technical rider.", error);
    return mapTechnicalRiderRow(data);
  }

  const { data, error } = await client
    .from("technical_riders")
    .insert({ event_id: input.eventId, ...fields })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the technical rider.", error);
  return mapTechnicalRiderRow(data);
}
