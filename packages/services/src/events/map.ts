import type { Database } from "@ngc/db";
import type { EventCategory, EventStatus, EventSummary } from "./types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export function mapEventSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    invitationId: row.invitation_id,
    name: row.name,
    eventCategory: row.event_category as EventCategory,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue,
    location: row.location,
    status: row.status as EventStatus,
    qrToken: row.qr_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
