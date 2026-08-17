export interface Itinerary {
  id: string;
  tripId: string;
  assignedMemberIds: string[];
  generatedAt: string;
  /**
   * Always `null` today — `documents` (0015) exists and the FK is already
   * wired up, but no PDF/document-generation module has been built by any
   * phase yet (deferred per ARCHITECTURE.md). `generateItinerary` never
   * sets this; it is exposed here only so the field is visible once a
   * later phase actually populates it.
   */
  generatedDocumentId: string | null;
  notes: string | null;
}

export interface GenerateItineraryInput {
  tripId: string;
  assignedMemberIds?: string[];
  notes?: string | null;
}

export interface UpdateItineraryInput {
  assignedMemberIds?: string[];
  notes?: string | null;
}
