import type { Database } from "@ngc/db";
import type { TechnicalRider } from "./types";

type Row = Database["public"]["Tables"]["technical_riders"]["Row"];

export function mapTechnicalRiderRow(row: Row): TechnicalRider {
  return {
    id: row.id,
    eventId: row.event_id,
    paRequirements: row.pa_requirements,
    lightingRequirements: row.lighting_requirements,
    ledDisplayRequirements: row.led_display_requirements,
    cameraRequirements: row.camera_requirements,
    recordingRequirements: row.recording_requirements,
    powerRequirements: row.power_requirements,
    stageRequirements: row.stage_requirements,
    monitoringRequirements: row.monitoring_requirements,
    crewNotes: row.crew_notes,
    setupTime: row.setup_time,
    soundcheckTime: row.soundcheck_time,
    technicalNotes: row.technical_notes,
    preparedBy: row.prepared_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
