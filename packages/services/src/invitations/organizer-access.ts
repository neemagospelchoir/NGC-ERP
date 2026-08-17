import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { listComments } from "../comments/list";
import type { CommentSummary } from "../comments/types";
import { mapInvitationSummary } from "./map";
import type { InvitationFormData, OrganizerCredentials, OrganizerView } from "./types";
import { hashToken, timingSafeEqual } from "./token";

type InvitationRow = Database["public"]["Tables"]["invitations"]["Row"];

const GENERIC_ACCESS_ERROR =
  "We couldn't verify that invitation. Check the invitation number, access code, and the email/phone you registered with.";

/**
 * The entire authorization boundary for every organizer-facing operation
 * — see token.ts's doc comment. Returns the SAME generic error whether
 * the invitation number doesn't exist, the token is wrong, or the
 * verification contact doesn't match (mirrors applications/applicant-
 * access.ts's `loadAndVerify` exactly, including the anti-oracle
 * rationale).
 */
async function loadAndVerify(client: SupabaseClient<Database>, creds: OrganizerCredentials): Promise<InvitationRow> {
  const invitationNumber = creds.invitationNumber.trim();
  const { data: row, error } = await client
    .from("invitations")
    .select("*")
    .eq("invitation_number", invitationNumber)
    .maybeSingle();

  if (error) throw new ServiceError("Could not look up the invitation.", error);
  if (!row) throw new ServiceError(GENERIC_ACCESS_ERROR);

  const providedHash = await hashToken(creds.accessToken);
  const tokenMatches = timingSafeEqual(providedHash, row.access_token_hash);
  const contactMatches = creds.verificationContact.trim().toLowerCase() === row.verification_contact.trim().toLowerCase();

  if (!tokenMatches || !contactMatches) throw new ServiceError(GENERIC_ACCESS_ERROR);

  return row;
}

export interface OrganizerViewResult {
  invitation: OrganizerView;
  /** Only comments an internal reviewer explicitly marked visible to the organizer (`is_internal: false`) — e.g. a "pending_information" request. Never the internal review thread. */
  visibleComments: CommentSummary[];
}

export async function getInvitationForOrganizer(client: SupabaseClient<Database>, creds: OrganizerCredentials): Promise<OrganizerViewResult> {
  const row = await loadAndVerify(client, creds);
  const allComments = await listComments(client, "invitation", row.id);
  return {
    invitation: mapInvitationSummary(row),
    visibleComments: allComments.filter((c) => !c.isInternal),
  };
}

/**
 * The organizer's half of the "Pending Information → organizer notified
 * → resubmit" loop (PRD §7.8/§9.2) — only reachable from
 * `pending_information`, mirroring applications' `incomplete` → resubmit
 * pattern. Moves the invitation back to `submitted` so it re-enters HR's
 * review queue from the top, exactly like `submitApplication()` accepts
 * from `incomplete` the same as from `draft`.
 */
export async function resubmitInvitation(
  client: SupabaseClient<Database>,
  creds: OrganizerCredentials,
  patch: Partial<InvitationFormData>
): Promise<OrganizerView> {
  const row = await loadAndVerify(client, creds);
  if (row.status !== "pending_information") {
    throw new ServiceError("This invitation isn't awaiting more information, so it can't be resubmitted here.");
  }

  const { data, error } = await client
    .from("invitations")
    .update({
      organizer_name: patch.organizerName?.trim() || row.organizer_name,
      organizer_contact_email: patch.organizerContactEmail !== undefined ? patch.organizerContactEmail || null : row.organizer_contact_email,
      organizer_contact_phone: patch.organizerContactPhone !== undefined ? patch.organizerContactPhone || null : row.organizer_contact_phone,
      organization_name: patch.organizationName !== undefined ? patch.organizationName || null : row.organization_name,
      event_name: patch.eventName?.trim() || row.event_name,
      event_type: patch.eventType !== undefined ? patch.eventType || null : row.event_type,
      proposed_date: patch.proposedDate?.trim() || row.proposed_date,
      proposed_time: patch.proposedTime !== undefined ? patch.proposedTime || null : row.proposed_time,
      venue: patch.venue !== undefined ? patch.venue || null : row.venue,
      location: patch.location !== undefined ? patch.location || null : row.location,
      region: patch.region !== undefined ? patch.region || null : row.region,
      expected_audience: patch.expectedAudience !== undefined ? patch.expectedAudience : row.expected_audience,
      nature_of_invitation: patch.natureOfInvitation !== undefined ? patch.natureOfInvitation || null : row.nature_of_invitation,
      performance_requirements:
        patch.performanceRequirements !== undefined ? patch.performanceRequirements || null : row.performance_requirements,
      technical_requirements:
        patch.technicalRequirements !== undefined ? patch.technicalRequirements || null : row.technical_requirements,
      transport_requirements:
        patch.transportRequirements !== undefined ? patch.transportRequirements || null : row.transport_requirements,
      accommodation_requirements:
        patch.accommodationRequirements !== undefined ? patch.accommodationRequirements || null : row.accommodation_requirements,
      financial_information: patch.financialInformation !== undefined ? patch.financialInformation || null : row.financial_information,
      additional_notes: patch.additionalNotes !== undefined ? patch.additionalNotes || null : row.additional_notes,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not resubmit the invitation.", error);
  return mapInvitationSummary(data);
}
