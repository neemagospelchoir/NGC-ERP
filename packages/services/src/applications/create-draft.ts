import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { computeCompleteness } from "./completeness";
import { EMPTY_APPLICATION_FORM_DATA } from "./types";
import { generateAccessToken, hashToken } from "./token";

const APPLICATION_NUMBER_SEQUENCE_KEY = "application_number";
const APPLICATION_NUMBER_SETTING_KEY = "id_format.application_number";
const FALLBACK_APPLICATION_NUMBER_FORMAT = "APP-{year}-{sequence}";

export interface CreateDraftApplicationInput {
  /** The applicant's chosen access channel (email or phone) — the second factor they'll supply alongside the token on every later visit. */
  verificationContact: string;
}

export interface CreateDraftApplicationResult {
  applicationId: string;
  applicationNumber: string;
  /** Shown to the applicant EXACTLY ONCE, here — only its hash is ever persisted (see token.ts). If they lose it, there is no "resend" in this phase (no notification channel is wired up yet — see docs/PHASE_7_2.md); losing it means starting a new draft. */
  accessToken: string;
}

/**
 * Starts a new application (PRD §9.1: "Public Link (/join) → Application
 * Form → Save as Draft/Submit → Application Number issued"). Deliberately
 * takes ONLY the verification contact at this step — the rest of the form
 * is filled in via updateApplicationDraft() so the applicant can save
 * progress incrementally rather than losing everything if their session
 * drops mid-form.
 *
 * Runs through the service-role client because `applications` has no
 * anon-role RLS policy at all (0005_onboarding.sql) — applicants never get
 * a Supabase Auth session (ARCHITECTURE.md §5.1). There is no permission
 * check here because there is no signed-in user to check — creating a
 * draft is the one operation in this module open to literally anyone, by
 * design (it's the public entry point).
 */
export async function createDraftApplication(
  client: SupabaseClient<Database>,
  input: CreateDraftApplicationInput
): Promise<CreateDraftApplicationResult> {
  const verificationContact = input.verificationContact.trim();
  if (!verificationContact) {
    throw new ServiceError("An email address or phone number is required to start an application.");
  }

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", APPLICATION_NUMBER_SETTING_KEY)
    .maybeSingle();

  if (formatError) {
    throw new ServiceError("Could not resolve the Application ID format.", formatError);
  }
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_APPLICATION_NUMBER_FORMAT;

  const { data: applicationNumber, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: APPLICATION_NUMBER_SEQUENCE_KEY,
    p_format: format,
  });

  if (rpcError || !applicationNumber) {
    throw new ServiceError("Could not generate an Application ID.", rpcError);
  }

  const accessToken = generateAccessToken();
  const accessTokenHash = await hashToken(accessToken);
  const { completionPercentage, missingFields } = computeCompleteness(EMPTY_APPLICATION_FORM_DATA);

  const { data, error } = await client
    .from("applications")
    .insert({
      application_number: applicationNumber,
      application_type: "new_member",
      access_token_hash: accessTokenHash,
      verification_contact: verificationContact,
      submitted_data: EMPTY_APPLICATION_FORM_DATA as unknown as Json,
      status: "draft",
      completion_percentage: completionPercentage,
      missing_fields: missingFields,
    })
    .select("id")
    .single();

  if (error) {
    throw new ServiceError("Could not start the application.", error);
  }

  return { applicationId: data.id, applicationNumber, accessToken };
}
