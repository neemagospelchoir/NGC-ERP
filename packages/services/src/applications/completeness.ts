import type { ApplicationFormData } from "./types";

/**
 * Fields required before an application can be submitted (PRD §9.1's
 * status pipeline requires a "completion_percentage" and "missing_fields"
 * to drive the Draft → Submitted transition and the Incomplete →
 * resubmit loop). The PRD names the form's sections but does not enumerate
 * exactly which fields within them are mandatory — this is a reasonable,
 * documented assumption (personal identity + contact + emergency contact +
 * current church), not a hardcoded organizational RULE in the sense the
 * master spec warns against (it's an application-shape decision, not
 * something like a fee amount or ID format); flag for confirmation with
 * NGC HR before go-live, same as the placeholder system_settings values in
 * supabase/seed/001_reference_data.sql.
 */
const REQUIRED_FIELDS: { path: string; label: string; get: (data: ApplicationFormData) => unknown }[] = [
  { path: "personal.firstName", label: "First name", get: (d) => d.personal.firstName },
  { path: "personal.lastName", label: "Last name", get: (d) => d.personal.lastName },
  { path: "personal.gender", label: "Gender", get: (d) => d.personal.gender },
  { path: "personal.dateOfBirth", label: "Date of birth", get: (d) => d.personal.dateOfBirth },
  { path: "personal.phone", label: "Phone", get: (d) => d.personal.phone },
  { path: "personal.email", label: "Email", get: (d) => d.personal.email },
  { path: "personal.physicalAddress", label: "Physical address", get: (d) => d.personal.physicalAddress },
  { path: "personal.emergencyContactName", label: "Emergency contact name", get: (d) => d.personal.emergencyContactName },
  { path: "personal.emergencyContactPhone", label: "Emergency contact phone", get: (d) => d.personal.emergencyContactPhone },
  { path: "church.currentChurch", label: "Current church", get: (d) => d.church.currentChurch },
];

function isFilled(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

export interface CompletenessResult {
  completionPercentage: number;
  missingFields: string[];
}

export function computeCompleteness(data: ApplicationFormData): CompletenessResult {
  const missingFields = REQUIRED_FIELDS.filter((f) => !isFilled(f.get(data))).map((f) => f.label);
  const filledCount = REQUIRED_FIELDS.length - missingFields.length;
  const completionPercentage = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);
  return { completionPercentage, missingFields };
}
