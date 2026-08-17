export type EventCategory = "invitation" | "worship_in_spirit" | "internal_performance" | "community_outreach" | "other";
export type EventStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "postponed";

export interface EventSummary {
  id: string;
  invitationId: string | null;
  name: string;
  eventCategory: EventCategory;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  location: string | null;
  status: EventStatus;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventFromInvitationInput {
  invitationId: string;
  name: string;
  eventDate: string;
  startTime?: string | null;
  venue?: string | null;
  location?: string | null;
}
