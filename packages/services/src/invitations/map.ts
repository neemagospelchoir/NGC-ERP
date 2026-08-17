import type { Database } from "@ngc/db";
import type { InvitationStatus, InvitationSummary } from "./types";

type InvitationRow = Database["public"]["Tables"]["invitations"]["Row"];

export function mapInvitationSummary(row: InvitationRow): InvitationSummary {
  return {
    id: row.id,
    invitationNumber: row.invitation_number,
    organizerName: row.organizer_name,
    organizerContactEmail: row.organizer_contact_email,
    organizerContactPhone: row.organizer_contact_phone,
    organizationName: row.organization_name,
    eventName: row.event_name,
    eventType: row.event_type,
    proposedDate: row.proposed_date,
    proposedTime: row.proposed_time,
    venue: row.venue,
    location: row.location,
    region: row.region,
    expectedAudience: row.expected_audience,
    natureOfInvitation: row.nature_of_invitation,
    performanceRequirements: row.performance_requirements,
    technicalRequirements: row.technical_requirements,
    transportRequirements: row.transport_requirements,
    accommodationRequirements: row.accommodation_requirements,
    financialInformation: row.financial_information,
    additionalNotes: row.additional_notes,
    status: row.status as InvitationStatus,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
