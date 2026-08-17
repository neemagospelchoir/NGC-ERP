import type { Database } from "@ngc/db";
import type { Itinerary } from "./types";

type Row = Database["public"]["Tables"]["itineraries"]["Row"];

export function mapItineraryRow(row: Row): Itinerary {
  return {
    id: row.id,
    tripId: row.trip_id,
    assignedMemberIds: row.assigned_member_ids,
    generatedAt: row.generated_at,
    generatedDocumentId: row.generated_document_id,
    notes: row.notes,
  };
}
