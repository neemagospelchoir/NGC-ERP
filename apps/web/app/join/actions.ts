"use server";

import { getSupabaseServiceRoleClient } from "@ngc/db";
import { applications } from "@ngc/services";

/**
 * Every action in this file runs through the SERVICE-ROLE client, not the
 * cookie-bound RLS-scoped one apps/web/lib/supabase/server.ts provides —
 * applicants never get a Supabase Auth session (ARCHITECTURE.md §5.1), so
 * there is no cookie-based identity here at all, and `applications` has no
 * anon-role RLS policy for the applicant's own record (0005_onboarding.sql).
 * The applications service functions' token/verification-contact check
 * (packages/services/src/applications/token.ts) is the ENTIRE
 * authorization boundary for this file — see that file's doc comment.
 */

export interface StartApplicationState {
  error?: string;
  result?: { applicationNumber: string; accessToken: string };
}

export async function startApplicationAction(
  _prevState: StartApplicationState,
  formData: FormData
): Promise<StartApplicationState> {
  const client = getSupabaseServiceRoleClient();
  try {
    const result = await applications.createDraftApplication(client, {
      verificationContact: String(formData.get("verificationContact") ?? ""),
    });
    return { result: { applicationNumber: result.applicationNumber, accessToken: result.accessToken } };
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not start an application. Please try again." };
  }
}

export interface LoadApplicationState {
  error?: string;
  view?: applications.ApplicantView;
}

export async function loadApplicationAction(
  _prevState: LoadApplicationState,
  formData: FormData
): Promise<LoadApplicationState> {
  const client = getSupabaseServiceRoleClient();
  try {
    const view = await applications.getApplicationForApplicant(client, {
      applicationNumber: String(formData.get("applicationNumber") ?? ""),
      accessToken: String(formData.get("accessToken") ?? ""),
      verificationContact: String(formData.get("verificationContact") ?? ""),
    });
    return { view };
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not verify that application." };
  }
}

export interface SaveApplicationState {
  error?: string;
  success?: boolean;
  view?: applications.ApplicantView;
}

function credentialsFrom(formData: FormData): applications.ApplicantCredentials {
  return {
    applicationNumber: String(formData.get("applicationNumber") ?? ""),
    accessToken: String(formData.get("accessToken") ?? ""),
    verificationContact: String(formData.get("verificationContact") ?? ""),
  };
}

function patchFrom(formData: FormData): Partial<applications.ApplicationFormData> {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v : undefined;
  };
  return {
    personal: {
      firstName: str("firstName"),
      middleName: str("middleName"),
      lastName: str("lastName"),
      preferredName: str("preferredName"),
      gender: str("gender"),
      dateOfBirth: str("dateOfBirth"),
      nationality: str("nationality"),
      nationalIdNumber: str("nationalIdNumber"),
      email: str("email"),
      phone: str("phone"),
      whatsappNumber: str("whatsappNumber"),
      physicalAddress: str("physicalAddress"),
      region: str("region"),
      district: str("district"),
      emergencyContactName: str("emergencyContactName"),
      emergencyContactPhone: str("emergencyContactPhone"),
    },
    church: {
      currentChurch: str("currentChurch"),
      churchLocation: str("churchLocation"),
      pastorName: str("pastorName"),
      churchMembershipInfo: str("churchMembershipInfo"),
      referralInfo: str("referralInfo"),
    },
    professional: {
      profession: str("profession"),
      employer: str("employer"),
    },
    choirHistory: {
      previouslyChoirMember: formData.get("previouslyChoirMember") === "on",
      previousChoirName: str("previousChoirName"),
      previousChoirDuration: str("previousChoirDuration"),
      previousChoirResponsibilities: str("previousChoirResponsibilities"),
      previousChoirLeaveReason: str("previousChoirLeaveReason"),
      musicalExperience: str("musicalExperience"),
    },
    musical: {
      vocalCategory: str("vocalCategory"),
      instrument: str("instrument"),
      musicTraining: str("musicTraining"),
      previousPerformanceExperience: str("previousPerformanceExperience"),
    },
  };
}

export async function saveApplicationDraftAction(
  _prevState: SaveApplicationState,
  formData: FormData
): Promise<SaveApplicationState> {
  const client = getSupabaseServiceRoleClient();
  try {
    const view = await applications.updateApplicationDraft(client, credentialsFrom(formData), patchFrom(formData));
    return { success: true, view };
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not save your application." };
  }
}

export async function submitApplicationAction(
  _prevState: SaveApplicationState,
  formData: FormData
): Promise<SaveApplicationState> {
  const client = getSupabaseServiceRoleClient();
  try {
    // Persist whatever was last edited before submitting, so a save+submit
    // click in one action doesn't lose the in-progress edit.
    await applications.updateApplicationDraft(client, credentialsFrom(formData), patchFrom(formData));
    const view = await applications.submitApplication(client, credentialsFrom(formData));
    return { success: true, view };
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not submit your application." };
  }
}
