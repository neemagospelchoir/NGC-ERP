import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapInvitationSummary } from "./map";
import type { InvitationDetail, InvitationStatus, InvitationSummary } from "./types";

export interface ListInvitationsOptions {
  status?: InvitationStatus;
}

/**
 * Lists invitations for internal review. No application-layer permission
 * check here — `invitations_select_internal` RLS (0008) already scopes
 * this to any signed-in user (a deliberate transparency-by-design choice
 * for this module, not a gap — see docs/PHASE_7_5.md §5 for the one
 * caveat this carries: `financial_information` is visible platform-wide
 * to any signed-in user, not just Finance). Write actions remain
 * permission-gated by `events.invitations.manage` regardless.
 */
export async function listInvitations(client: SupabaseClient<Database>, options: ListInvitationsOptions = {}): Promise<InvitationSummary[]> {
  let query = client.from("invitations").select("*").order("created_at", { ascending: false });
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load invitations.", error);
  return (data ?? []).map(mapInvitationSummary);
}

export async function getInvitation(client: SupabaseClient<Database>, id: string): Promise<InvitationDetail | null> {
  const { data, error } = await client.from("invitations").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the invitation.", error);
  return data ? mapInvitationSummary(data) : null;
}

/** Batch lookup for the Approval Center (apps/web/app/(erp)/approvals/page.tsx), which has a list of record ids to label, not one id to fetch — same flat `.in()` pattern as discipline/list.ts's `resolveMemberNames()`. */
export async function listInvitationsByIds(client: SupabaseClient<Database>, ids: string[]): Promise<InvitationSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client.from("invitations").select("*").in("id", ids);
  if (error) throw new ServiceError("Could not load invitations.", error);
  return (data ?? []).map(mapInvitationSummary);
}
