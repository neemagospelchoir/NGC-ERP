import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { generateAccessToken, hashToken } from "./token";
import type { SubmitInvitationInput, SubmitInvitationResult } from "./types";

const INVITATION_NUMBER_SEQUENCE_KEY = "invitation_number";
const INVITATION_NUMBER_SETTING_KEY = "id_format.invitation_number";
const FALLBACK_INVITATION_NUMBER_FORMAT = "INV-{year}-{sequence}";

/**
 * PRD §7.24 ("Public submission → validation → Invitation ID issued...")
 * — unlike Onboarding's `/join`, which lets an applicant save a long,
 * multi-section form as a draft across visits, this is a single-shot
 * public submit: the invitation form is one page's worth of fields, and
 * §7.24's own flow chart has no "save progress" step, only "submit". The
 * `draft` status still exists in the check constraint
 * (0008_invitations_events.sql) for potential future internal/manual use;
 * the public path here goes straight to `submitted`.
 *
 * Runs through the service-role client — `invitations` has no anon-role
 * RLS policy at all, since organizers never get a Supabase Auth session
 * (mirrors applications/create-draft.ts's rationale exactly).
 */
export async function submitInvitation(client: SupabaseClient<Database>, input: SubmitInvitationInput): Promise<SubmitInvitationResult> {
  const organizerName = input.organizerName.trim();
  const eventName = input.eventName.trim();
  const verificationContact = input.verificationContact.trim();
  const proposedDate = input.proposedDate.trim();

  if (!organizerName) throw new ServiceError("The organizer's name is required.");
  if (!eventName) throw new ServiceError("The event name is required.");
  if (!proposedDate) throw new ServiceError("A proposed event date is required.");
  if (!verificationContact) throw new ServiceError("An email address or phone number is required to check this invitation's status later.");

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", INVITATION_NUMBER_SETTING_KEY)
    .maybeSingle();
  if (formatError) throw new ServiceError("Could not resolve the Invitation ID format.", formatError);
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_INVITATION_NUMBER_FORMAT;

  const { data: invitationNumber, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: INVITATION_NUMBER_SEQUENCE_KEY,
    p_format: format,
  });
  if (rpcError || !invitationNumber) throw new ServiceError("Could not generate an Invitation ID.", rpcError);

  const accessToken = generateAccessToken();
  const accessTokenHash = await hashToken(accessToken);

  const { data, error } = await client
    .from("invitations")
    .insert({
      invitation_number: invitationNumber,
      organizer_name: organizerName,
      organizer_contact_email: input.organizerContactEmail || null,
      organizer_contact_phone: input.organizerContactPhone || null,
      organization_name: input.organizationName || null,
      event_name: eventName,
      event_type: input.eventType || null,
      proposed_date: proposedDate,
      proposed_time: input.proposedTime || null,
      venue: input.venue || null,
      location: input.location || null,
      region: input.region || null,
      expected_audience: input.expectedAudience ?? null,
      nature_of_invitation: input.natureOfInvitation || null,
      performance_requirements: input.performanceRequirements || null,
      technical_requirements: input.technicalRequirements || null,
      transport_requirements: input.transportRequirements || null,
      accommodation_requirements: input.accommodationRequirements || null,
      financial_information: input.financialInformation || null,
      additional_notes: input.additionalNotes || null,
      access_token_hash: accessTokenHash,
      verification_contact: verificationContact,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new ServiceError("Could not submit the invitation.", error);

  return { invitationId: data.id, invitationNumber, accessToken };
}
