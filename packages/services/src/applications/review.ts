import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapApplicationDetail } from "./map";
import type { ApplicationDetail, ApplicationStatus } from "./types";

/**
 * The forward-only status graph HR can drive an application through (PRD
 * §9.1's pipeline). Deliberately a fixed table, not "set status to
 * anything" — an application can't jump from `draft` straight to
 * `approved`, and a decision can't be un-made through these functions
 * (correcting a wrong decision is an explicit, audited follow-up action in
 * a later phase, not a silent status edit). `probation`/`probation_completed`/
 * `probation_failed`/`converted_to_member` transitions are driven by
 * convert.ts and probation's own module, not this file.
 */
const FORWARD_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  submitted: ["pending_review", "incomplete"],
  pending_review: ["under_verification", "incomplete"],
  under_verification: ["pending_approval", "incomplete"],
  pending_approval: ["approved", "rejected", "incomplete"],
};

function assertTransition(current: ApplicationStatus, next: ApplicationStatus): void {
  const allowed = FORWARD_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ServiceError(`Cannot move an application from "${current}" to "${next}".`);
  }
}

async function loadCurrent(client: SupabaseClient<Database>, id: string): Promise<ApplicationDetail> {
  const { data, error } = await client.from("applications").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the application.", error);
  if (!data) throw new ServiceError("Application not found.");
  return mapApplicationDetail(data);
}

/**
 * Plain status-only advance along the review pipeline (submitted →
 * pending_review → under_verification → pending_approval). No
 * application-layer permission check — `applications_write_hr` RLS (0005)
 * already requires `members.applications.manage` for this UPDATE, the
 * same "trust Postgres" pattern used throughout this codebase for
 * RLS-scoped-client operations.
 */
export async function advanceApplicationStatus(
  client: SupabaseClient<Database>,
  applicationId: string,
  nextStatus: "pending_review" | "under_verification" | "pending_approval"
): Promise<ApplicationDetail> {
  const current = await loadCurrent(client, applicationId);
  assertTransition(current.status, nextStatus);

  const { data, error } = await client
    .from("applications")
    .update({ status: nextStatus })
    .eq("id", applicationId)
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not update the application's status.", error);
  return mapApplicationDetail(data);
}

/** HR sends the application back to the applicant with specific, free-text notes on what's missing/wrong — reuses `missing_fields` (distinct from its auto-computed pre-submission use in completeness.ts; both describe "what the applicant still needs to address," just at different pipeline stages). The applicant re-submits via submitApplication(), which accepts from `incomplete` the same as from `draft`. */
export async function markApplicationIncomplete(
  client: SupabaseClient<Database>,
  applicationId: string,
  notes: string[]
): Promise<ApplicationDetail> {
  const trimmedNotes = notes.map((n) => n.trim()).filter(Boolean);
  if (trimmedNotes.length === 0) {
    throw new ServiceError("Provide at least one note describing what the applicant needs to fix.");
  }

  const current = await loadCurrent(client, applicationId);
  assertTransition(current.status, "incomplete");

  const { data, error } = await client
    .from("applications")
    .update({ status: "incomplete", missing_fields: trimmedNotes })
    .eq("id", applicationId)
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not mark the application incomplete.", error);
  return mapApplicationDetail(data);
}

export interface DecideApplicationInput {
  reviewerId: string;
  decision: "approved" | "rejected";
  /** Human-authored substantive reason (PRD spec S43: "AI may format into a letter but never invents this"). AI-assisted letter drafting itself is out of scope for this phase — see docs/PHASE_7_2.md. */
  reason: string;
}

export async function decideApplication(
  client: SupabaseClient<Database>,
  applicationId: string,
  input: DecideApplicationInput
): Promise<ApplicationDetail> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new ServiceError("A decision reason is required.");
  }

  const current = await loadCurrent(client, applicationId);
  assertTransition(current.status, input.decision);

  const { data, error } = await client
    .from("applications")
    .update({
      status: input.decision,
      reviewed_by: input.reviewerId,
      reviewed_at: new Date().toISOString(),
      decision_reason: reason,
    })
    .eq("id", applicationId)
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not record the decision.", error);
  return mapApplicationDetail(data);
}
