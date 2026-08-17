import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapApplicationDetail, mapApplicationSummary } from "./map";
import type { ApplicationDetail, ApplicationStatus, ApplicationSummary } from "./types";

export interface ListApplicationsOptions {
  status?: ApplicationStatus;
  /** Matched against application number or applicant name (case-insensitive substring, applied client-side — see doc comment below). */
  search?: string;
}

/**
 * Lists applications for HR review. No application-layer permission check
 * is needed here — `applications_select_hr` RLS (0005) already restricts
 * this to callers holding `members.applications.read`, same "trust
 * Postgres" pattern as every other list function in this codebase.
 *
 * `search` is applied in JS after the fetch, not as a PostgREST filter:
 * the applicant's name lives inside `submitted_data` (JSONB), and the
 * hand-generated Database type (packages/db) gives supabase-js no typed
 * helper for a JSON-path `ilike` filter the way it does for a plain
 * column — the raw PostgREST `->>` path syntax exists but would be
 * untyped, easy to typo, and awkward to replicate faithfully in the fake
 * test client. For this ERP's expected data volume (one choir, not
 * millions of applicants) fetching by status and filtering client-side is
 * simple, fully typed, and easy to test — flagged here as the tradeoff it
 * is, not an oversight.
 */
export async function listApplications(
  client: SupabaseClient<Database>,
  options: ListApplicationsOptions = {}
): Promise<ApplicationSummary[]> {
  let query = client.from("applications").select("*").order("created_at", { ascending: false });
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) {
    throw new ServiceError("Could not load applications.", error);
  }

  let summaries = (data ?? []).map(mapApplicationSummary);

  const term = options.search?.trim().toLowerCase();
  if (term) {
    summaries = summaries.filter(
      (s) => s.applicantName.toLowerCase().includes(term) || s.applicationNumber.toLowerCase().includes(term)
    );
  }

  return summaries;
}

export async function getApplication(client: SupabaseClient<Database>, id: string): Promise<ApplicationDetail | null> {
  const { data, error } = await client.from("applications").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new ServiceError("Could not load the application.", error);
  }
  return data ? mapApplicationDetail(data) : null;
}
