"use server";

import { getSupabaseServiceRoleClient } from "@ngc/db";
import { invitations } from "@ngc/services";

/**
 * Every action here runs through the SERVICE-ROLE client, mirroring
 * apps/web/app/join/actions.ts exactly — external organizers never get a
 * Supabase Auth session, and `invitations` has no anon-role RLS policy at
 * all (0008_invitations_events.sql). The token/verification-contact check
 * in packages/services/src/invitations/token.ts is the ENTIRE
 * authorization boundary for this file.
 */

export interface SubmitInvitationState {
  error?: string;
  result?: { invitationNumber: string; accessToken: string };
}

function formDataToInput(formData: FormData): invitations.SubmitInvitationInput {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v : undefined;
  };
  const audience = str("expectedAudience");
  return {
    organizerName: String(formData.get("organizerName") ?? ""),
    organizerContactEmail: str("organizerContactEmail"),
    organizerContactPhone: str("organizerContactPhone"),
    organizationName: str("organizationName"),
    eventName: String(formData.get("eventName") ?? ""),
    eventType: str("eventType"),
    proposedDate: String(formData.get("proposedDate") ?? ""),
    proposedTime: str("proposedTime"),
    venue: str("venue"),
    location: str("location"),
    region: str("region"),
    expectedAudience: audience ? Number(audience) : undefined,
    natureOfInvitation: str("natureOfInvitation"),
    performanceRequirements: str("performanceRequirements"),
    technicalRequirements: str("technicalRequirements"),
    transportRequirements: str("transportRequirements"),
    accommodationRequirements: str("accommodationRequirements"),
    financialInformation: str("financialInformation"),
    additionalNotes: str("additionalNotes"),
    verificationContact: String(formData.get("verificationContact") ?? ""),
  };
}

export async function submitInvitationAction(_prevState: SubmitInvitationState, formData: FormData): Promise<SubmitInvitationState> {
  const client = getSupabaseServiceRoleClient();
  try {
    const result = await invitations.submitInvitation(client, formDataToInput(formData));
    return { result: { invitationNumber: result.invitationNumber, accessToken: result.accessToken } };
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not submit the invitation. Please try again." };
  }
}

export interface LoadInvitationState {
  error?: string;
  view?: invitations.OrganizerViewResult;
}

export async function loadInvitationAction(_prevState: LoadInvitationState, formData: FormData): Promise<LoadInvitationState> {
  const client = getSupabaseServiceRoleClient();
  try {
    const view = await invitations.getInvitationForOrganizer(client, {
      invitationNumber: String(formData.get("invitationNumber") ?? ""),
      accessToken: String(formData.get("accessToken") ?? ""),
      verificationContact: String(formData.get("verificationContact") ?? ""),
    });
    return { view };
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not verify that invitation." };
  }
}

export interface ResubmitInvitationState {
  error?: string;
  success?: boolean;
  view?: invitations.OrganizerViewResult;
}

export async function resubmitInvitationAction(_prevState: ResubmitInvitationState, formData: FormData): Promise<ResubmitInvitationState> {
  const client = getSupabaseServiceRoleClient();
  const creds: invitations.OrganizerCredentials = {
    invitationNumber: String(formData.get("invitationNumber") ?? ""),
    accessToken: String(formData.get("accessToken") ?? ""),
    verificationContact: String(formData.get("verificationContact") ?? ""),
  };
  try {
    const patch = formDataToInput(formData);
    await invitations.resubmitInvitation(client, creds, patch);
    const view = await invitations.getInvitationForOrganizer(client, creds);
    return { success: true, view };
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not resubmit the invitation." };
  }
}
