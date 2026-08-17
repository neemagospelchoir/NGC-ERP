export interface TechnicalRider {
  id: string;
  eventId: string;
  paRequirements: string | null;
  lightingRequirements: string | null;
  ledDisplayRequirements: string | null;
  cameraRequirements: string | null;
  recordingRequirements: string | null;
  powerRequirements: string | null;
  stageRequirements: string | null;
  monitoringRequirements: string | null;
  crewNotes: string | null;
  setupTime: string | null;
  soundcheckTime: string | null;
  technicalNotes: string | null;
  preparedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `eventId` plus every field below map straight onto PRD §7.9's rider
 * fields (PA, lighting, LED, camera, recording, power, stage, monitoring,
 * crew, setup/soundcheck time). There is no separate equipment-line-items
 * table — 0009's own header comment describes one (`technical_rider_items`
 * linked to `asset_categories`) as a future addition once Inventory (0010)
 * existed, but no later migration ever created it; the rider stays the
 * free-text-fields-only shape the schema actually has today. See
 * docs/PHASE_8_4.md §7 for this flagged as an open gap rather than an
 * invented table.
 */
export interface UpsertTechnicalRiderInput {
  eventId: string;
  paRequirements?: string | null;
  lightingRequirements?: string | null;
  ledDisplayRequirements?: string | null;
  cameraRequirements?: string | null;
  recordingRequirements?: string | null;
  powerRequirements?: string | null;
  stageRequirements?: string | null;
  monitoringRequirements?: string | null;
  crewNotes?: string | null;
  setupTime?: string | null;
  soundcheckTime?: string | null;
  technicalNotes?: string | null;
  preparedBy?: string | null;
}
