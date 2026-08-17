import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { computeCompleteness } from "./completeness";
import { mapApplicationSummary, normalizeFormData } from "./map";
import type { ApplicantView, ApplicationFormData } from "./types";
import { hashToken, timingSafeEqual } from "./token";

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

export interface ApplicantCredentials {
  applicationNumber: string;
  accessToken: string;
  verificationContact: string;
}

const GENERIC_ACCESS_ERROR =
  "We couldn't verify that application. Check the application number, access code, and the email/phone you registered with.";

/**
 * The entire authorization boundary for every applicant-facing operation —
 * see token.ts's doc comment. Deliberately returns the SAME generic error
 * whether the application number doesn't exist, the token is wrong, or the
 * verification contact doesn't match, so a caller can't use error-message
 * differences as an oracle to enumerate valid application numbers or
 * confirm a guessed token.
 */
async function loadAndVerify(client: SupabaseClient<Database>, creds: ApplicantCredentials): Promise<ApplicationRow> {
  const applicationNumber = creds.applicationNumber.trim();
  const { data: row, error } = await client
    .from("applications")
    .select("*")
    .eq("application_number", applicationNumber)
    .maybeSingle();

  if (error) {
    throw new ServiceError("Could not look up the application.", error);
  }
  if (!row) {
    throw new ServiceError(GENERIC_ACCESS_ERROR);
  }

  const providedHash = await hashToken(creds.accessToken);
  const tokenMatches = timingSafeEqual(providedHash, row.access_token_hash);
  const contactMatches = creds.verificationContact.trim().toLowerCase() === row.verification_contact.trim().toLowerCase();

  if (!tokenMatches || !contactMatches) {
    throw new ServiceError(GENERIC_ACCESS_ERROR);
  }

  return row;
}

export async function getApplicationForApplicant(
  client: SupabaseClient<Database>,
  creds: ApplicantCredentials
): Promise<ApplicantView> {
  const row = await loadAndVerify(client, creds);
  return toApplicantView(row);
}

/**
 * Merges a partial form-data patch into the application's current data,
 * one section at a time (shallow per-section merge — a section provided
 * in the patch replaces only the fields it names, never the whole
 * section), recomputes completeness, and persists. Editable only while
 * the application is still in `draft` or `incomplete` — once submitted, it
 * is HR's review queue, not the applicant's draft, per the status pipeline
 * (PRD §9.1).
 */
export async function updateApplicationDraft(
  client: SupabaseClient<Database>,
  creds: ApplicantCredentials,
  patch: Partial<ApplicationFormData>
): Promise<ApplicantView> {
  const row = await loadAndVerify(client, creds);
  if (row.status !== "draft" && row.status !== "incomplete") {
    throw new ServiceError("This application has already been submitted and can no longer be edited here.");
  }

  const current = normalizeFormData(row.submitted_data);
  const merged: ApplicationFormData = {
    personal: { ...current.personal, ...patch.personal },
    church: { ...current.church, ...patch.church },
    education: { ...current.education, ...patch.education },
    professional: { ...current.professional, ...patch.professional },
    choirHistory: { ...current.choirHistory, ...patch.choirHistory },
    musical: { ...current.musical, ...patch.musical },
  };

  const { completionPercentage, missingFields } = computeCompleteness(merged);

  const { data, error } = await client
    .from("applications")
    .update({
      submitted_data: merged as unknown as Json,
      completion_percentage: completionPercentage,
      missing_fields: missingFields,
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("Could not save your application.", error);
  }

  return toApplicantView(data);
}

export async function submitApplication(
  client: SupabaseClient<Database>,
  creds: ApplicantCredentials
): Promise<ApplicantView> {
  const row = await loadAndVerify(client, creds);
  if (row.status !== "draft" && row.status !== "incomplete") {
    throw new ServiceError("This application has already been submitted.");
  }

  const formData = normalizeFormData(row.submitted_data);
  const { completionPercentage, missingFields } = computeCompleteness(formData);
  if (missingFields.length > 0) {
    throw new ServiceError(`Please complete the following before submitting: ${missingFields.join(", ")}.`);
  }

  const { data, error } = await client
    .from("applications")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      completion_percentage: completionPercentage,
      missing_fields: [],
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("Could not submit your application.", error);
  }

  return toApplicantView(data);
}

function toApplicantView(row: ApplicationRow): ApplicantView {
  const summary = mapApplicationSummary(row);
  return {
    applicationNumber: summary.applicationNumber,
    applicationType: summary.applicationType,
    status: summary.status,
    completionPercentage: summary.completionPercentage,
    missingFields: summary.missingFields,
    formData: normalizeFormData(row.submitted_data),
    submittedAt: summary.submittedAt,
  };
}
