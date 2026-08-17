import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { addComment } from "../comments/list";
import { mapInvitationSummary } from "./map";
import type { InvitationDetail, InvitationStatus } from "./types";

/**
 * The manually-driven half of PRD §7.8/§9.2's status pipeline (the
 * approval-chain-driven half — pending_management_approval → approved/
 * declined — lives in approval.ts; the organizer-driven half —
 * pending_information → submitted — lives in organizer-access.ts's
 * resubmitInvitation()). Forward-only, same fixed-graph discipline as
 * applications/review.ts.
 */
const FORWARD_TRANSITIONS: Partial<Record<InvitationStatus, InvitationStatus[]>> = {
  submitted: ["received", "cancelled"],
  received: ["under_review", "cancelled"],
  under_review: ["pending_information", "pending_management_approval", "cancelled"],
  pending_management_approval: ["cancelled"], // normal advance is via approval.ts's workflow decisions, not this function
  approved: ["completed", "postponed", "cancelled"],
  postponed: ["approved", "cancelled"],
};

async function loadCurrent(client: SupabaseClient<Database>, id: string): Promise<InvitationDetail> {
  const { data, error } = await client.from("invitations").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the invitation.", error);
  if (!data) throw new ServiceError("Invitation not found.");
  return mapInvitationSummary(data);
}

function assertTransition(current: InvitationStatus, next: InvitationStatus): void {
  const allowed = FORWARD_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ServiceError(`Cannot move an invitation from "${current}" to "${next}".`);
  }
}

export async function advanceInvitationStatus(
  client: SupabaseClient<Database>,
  invitationId: string,
  nextStatus: "received" | "under_review" | "completed" | "postponed" | "approved"
): Promise<InvitationDetail> {
  const current = await loadCurrent(client, invitationId);
  assertTransition(current.status, nextStatus);

  const { data, error } = await client.from("invitations").update({ status: nextStatus }).eq("id", invitationId).select("*").single();
  if (error) throw new ServiceError("Could not update the invitation's status.", error);
  return mapInvitationSummary(data);
}

export interface RequestInvitationInformationInput {
  requestedBy: string;
  /** Shown to the organizer on their status-check page (posted as an `is_internal: false` comment) — never silently withheld. */
  note: string;
}

export async function requestInvitationInformation(
  client: SupabaseClient<Database>,
  invitationId: string,
  input: RequestInvitationInformationInput
): Promise<InvitationDetail> {
  const note = input.note.trim();
  if (!note) throw new ServiceError("Describe what the organizer needs to provide or fix.");

  const current = await loadCurrent(client, invitationId);
  assertTransition(current.status, "pending_information");

  const { data, error } = await client
    .from("invitations")
    .update({ status: "pending_information" })
    .eq("id", invitationId)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not mark the invitation as pending information.", error);

  await addComment(client, { ownerType: "invitation", ownerId: invitationId, authorId: input.requestedBy, body: note, isInternal: false });

  return mapInvitationSummary(data);
}

export async function cancelInvitation(
  client: SupabaseClient<Database>,
  invitationId: string,
  input: { cancelledBy: string; reason: string }
): Promise<InvitationDetail> {
  const reason = input.reason.trim();
  if (!reason) throw new ServiceError("A cancellation reason is required.");

  const current = await loadCurrent(client, invitationId);
  assertTransition(current.status, "cancelled");

  const { data, error } = await client.from("invitations").update({ status: "cancelled" }).eq("id", invitationId).select("*").single();
  if (error) throw new ServiceError("Could not cancel the invitation.", error);

  await addComment(client, { ownerType: "invitation", ownerId: invitationId, authorId: input.cancelledBy, body: `Cancelled: ${reason}`, isInternal: false });

  return mapInvitationSummary(data);
}
