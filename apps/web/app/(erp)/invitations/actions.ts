"use server";

import { revalidatePath } from "next/cache";
import { auth, comments, invitations } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here runs through the cookie-bound RLS-scoped client.
 * `invitations_write_scoped` (0008) already requires
 * `events.invitations.manage` for any write — no application-layer
 * permission check is duplicated here for the plain status/comment
 * actions, same "trust Postgres" discipline as every prior module. The
 * one exception is `recordApprovalDecisionAction`, which — like
 * Discipline's status-changing RPCs — goes through
 * `invitations.decideInvitationApproval()`, itself backed by the
 * `record_workflow_decision` SECURITY DEFINER function (0028), precisely
 * because the intermediate approvers (Technical Manager, Finance Manager)
 * hold no direct RLS write grant on `workflow_instances` at all — see
 * that migration's file header.
 */

export interface InvitationActionState {
  error?: string;
}

export async function advanceInvitationStatusAction(
  invitationId: string,
  next: "received" | "under_review" | "completed" | "postponed" | "approved",
  _prevState: InvitationActionState,
  _formData: FormData
): Promise<InvitationActionState> {
  const supabase = await createClient();
  try {
    await invitations.advanceInvitationStatus(supabase, invitationId, next);
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not update the invitation's status." };
  }
  revalidatePath(`/invitations/${invitationId}`);
  revalidatePath("/invitations");
  return {};
}

export async function requestInvitationInformationAction(
  invitationId: string,
  _prevState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await invitations.requestInvitationInformation(supabase, invitationId, {
      requestedBy: currentUser.id,
      note: String(formData.get("note") ?? ""),
    });
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not request more information." };
  }
  revalidatePath(`/invitations/${invitationId}`);
  revalidatePath("/invitations");
  return {};
}

export async function cancelInvitationAction(invitationId: string, _prevState: InvitationActionState, formData: FormData): Promise<InvitationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await invitations.cancelInvitation(supabase, invitationId, { cancelledBy: currentUser.id, reason: String(formData.get("reason") ?? "") });
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not cancel the invitation." };
  }
  revalidatePath(`/invitations/${invitationId}`);
  revalidatePath("/invitations");
  return {};
}

export async function startInvitationApprovalAction(
  invitationId: string,
  _prevState: InvitationActionState,
  _formData: FormData
): Promise<InvitationActionState> {
  const supabase = await createClient();
  try {
    await invitations.startInvitationApproval(supabase, invitationId);
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not start the approval workflow." };
  }
  revalidatePath(`/invitations/${invitationId}`);
  revalidatePath("/invitations");
  revalidatePath("/approvals");
  return {};
}

export async function addInvitationCommentAction(invitationId: string, _prevState: InvitationActionState, formData: FormData): Promise<InvitationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await comments.addComment(supabase, { ownerType: "invitation", ownerId: invitationId, authorId: currentUser.id, body: String(formData.get("body") ?? "") });
  } catch (err) {
    if (err instanceof comments.ServiceError) return { error: err.message };
    return { error: "Could not post the comment." };
  }
  revalidatePath(`/invitations/${invitationId}`);
  return {};
}

/**
 * Recording an approval decision — reusable from BOTH the invitation
 * detail page and the cross-module Approval Center (/approvals), which is
 * exactly why this composition lives here rather than being duplicated:
 * `decideInvitationApproval()` is the only place that knows an
 * invitation's approval outcome should update `invitations.status` and
 * (on final approval) create the `events` row — the generic workflow
 * engine (packages/services/src/workflow) deliberately does not know
 * that.
 */
export async function recordInvitationApprovalDecisionAction(
  invitationId: string,
  _prevState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approve" && decision !== "reject" && decision !== "request_changes") {
    return { error: "Choose a decision." };
  }

  try {
    await invitations.decideInvitationApproval(supabase, {
      invitationId,
      decision,
      comment: String(formData.get("comment") ?? "") || null,
      actingUserId: currentUser.id,
      actingUserRoleCodes: currentUser.roles.map((r) => r.code),
    });
  } catch (err) {
    if (err instanceof invitations.ServiceError) return { error: err.message };
    return { error: "Could not record the approval decision." };
  }
  revalidatePath(`/invitations/${invitationId}`);
  revalidatePath("/invitations");
  revalidatePath("/approvals");
  revalidatePath("/events");
  return {};
}
