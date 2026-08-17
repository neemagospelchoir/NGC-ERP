import type { Database } from "@ngc/db";
import { EMPTY_APPLICATION_FORM_DATA, type ApplicationDetail, type ApplicationFormData, type ApplicationStatus, type ApplicationSummary } from "./types";

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

/** `submitted_data` is stored as JSONB with no schema enforcement at the DB layer — this is the one place a malformed/partial blob (e.g. from an older form version) gets normalized back into the full shape rather than crashing a page on a missing section. */
export function normalizeFormData(raw: unknown): ApplicationFormData {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<ApplicationFormData>;
  return {
    personal: { ...EMPTY_APPLICATION_FORM_DATA.personal, ...value.personal },
    church: { ...EMPTY_APPLICATION_FORM_DATA.church, ...value.church },
    education: { ...EMPTY_APPLICATION_FORM_DATA.education, ...value.education },
    professional: { ...EMPTY_APPLICATION_FORM_DATA.professional, ...value.professional },
    choirHistory: { ...EMPTY_APPLICATION_FORM_DATA.choirHistory, ...value.choirHistory },
    musical: { ...EMPTY_APPLICATION_FORM_DATA.musical, ...value.musical },
  };
}

function applicantNameFrom(data: ApplicationFormData): string {
  const { firstName, lastName } = data.personal;
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || "(name not yet provided)";
}

export function mapApplicationSummary(row: ApplicationRow): ApplicationSummary {
  const formData = normalizeFormData(row.submitted_data);
  return {
    id: row.id,
    applicationNumber: row.application_number,
    applicationType: row.application_type,
    status: row.status as ApplicationStatus,
    completionPercentage: row.completion_percentage,
    missingFields: row.missing_fields ?? [],
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    applicantName: applicantNameFrom(formData),
    verificationContact: row.verification_contact,
  };
}

export function mapApplicationDetail(row: ApplicationRow): ApplicationDetail {
  return {
    ...mapApplicationSummary(row),
    formData: normalizeFormData(row.submitted_data),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    decisionReason: row.decision_reason,
    updatedAt: row.updated_at,
  };
}
