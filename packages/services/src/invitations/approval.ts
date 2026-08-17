import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { addComment } from "../comments/list";
import { createEventFromInvitation } from "../events/create-from-invitation";
import { startWorkflow, getWorkflowForRecord, recordWorkflowDecision } from "../workflow";
import type { WorkflowDecisionType } from "../workflow/types";
import { mapInvitationSummary } from "./map";
import type { InvitationDetail } from "./types";

const RECORD_TYPE = "invitation";

async function loadCurrent(client: SupabaseClient<Database>, id: string): Promise<InvitationDetail> {
  const { data, error } = await client.from("invitations").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the invitation.", error);
  if (!data) throw new ServiceError("Invitation not found.");
  return mapInvitationSummary(data);
}

/**
 * PRD §9.2: "Under Review → ... → Approval chain (configurable, default:
 * Secretary → Technical → Finance → Chairman)". Moves the invitation to
 * `pending_management_approval` and starts its `workflow_instances` row
 * against the seeded "Standard Invitation Approval" definition
 * (001_reference_data.sql) — a plain RLS-scoped write (both the status
 * UPDATE and the workflow_instances INSERT require permissions Secretary/
 * Super Admin hold: `events.invitations.manage` and `management.approvals.
 * manage` respectively), unlike decideInvitationApproval()'s step
 * decisions, which must go through the `record_workflow_decision` RPC —
 * see 0028's file header for why.
 *
 * RESUME case: a `request_changes` decision (see decideInvitationApproval
 * below) leaves the SAME workflow_instances row `pending` at the SAME
 * step — it never gets torn down — so once the organizer resubmits and
 * HR walks the invitation back through received/under_review, this
 * function must NOT try to create a second instance (0019's `unique
 * (record_type, record_id)` would reject it anyway). It checks for an
 * existing instance first and, if found, only updates the invitation's
 * status — the existing instance already has the right approver waiting.
 */
export async function startInvitationApproval(client: SupabaseClient<Database>, invitationId: string): Promise<InvitationDetail> {
  const current = await loadCurrent(client, invitationId);
  if (current.status !== "under_review") {
    throw new ServiceError('An invitation must be "under review" before its approval chain can start.');
  }

  const existingInstance = await getWorkflowForRecord(client, RECORD_TYPE, invitationId);
  if (!existingInstance) {
    await startWorkflow(client, { recordType: RECORD_TYPE, recordId: invitationId });
  }

  const { data, error } = await client
    .from("invitations")
    .update({ status: "pending_management_approval" })
    .eq("id", invitationId)
    .select("*")
    .single();
  if (error) {
    throw new ServiceError(
      "The approval workflow was started, but the invitation's status could not be updated. Please contact an administrator.",
      error
    );
  }
  return mapInvitationSummary(data);
}

export interface DecideInvitationApprovalInput {
  invitationId: string;
  decision: WorkflowDecisionType;
  comment?: string | null;
  actingUserId: string;
  actingUserRoleCodes: string[];
}

export interface DecideInvitationApprovalResult {
  invitation: InvitationDetail;
  workflowStatus: "pending" | "approved" | "rejected" | "cancelled";
}

/**
 * Records one approver's decision on the invitation's current approval
 * step, then reacts to the outcome — this is the "workflow engine stays
 * decoupled from module-specific side effects, but the module reacts to
 * its own record's workflow" composition ARCHITECTURE.md §12 describes:
 *
 *   - fully `approved` (last step just approved) → invitation → `approved`
 *     + an `events` row is created (PRD §9.2's "Approved → published to
 *     internal Calendar... → Technical Rider generated...", of which this
 *     phase builds only the `events` row itself — see events/create-from-
 *     invitation.ts's doc comment for what's deferred).
 *   - `rejected` → invitation → `declined`.
 *   - `request_changes` → invitation → `pending_information`, AND the
 *     same comment is also posted as an organizer-visible (`is_internal:
 *     false`) comment, so the organizer's status page shows WHY — the
 *     workflow_step_decisions.comment column itself is an internal
 *     approval record, not something the organizer's token-scoped view
 *     reads.
 *   - `approve` but not yet the last step → invitation status is
 *     unchanged (still `pending_management_approval`); the workflow
 *     instance itself has already advanced to the next step.
 *
 * Not atomic across the 2-3 writes involved — same documented,
 * non-silent limitation as every other multi-step write in this codebase
 * (discipline/record-action.ts, applications/convert.ts, ...).
 */
export async function decideInvitationApproval(
  client: SupabaseClient<Database>,
  input: DecideInvitationApprovalInput
): Promise<DecideInvitationApprovalResult> {
  const instance = await getWorkflowForRecord(client, RECORD_TYPE, input.invitationId);
  if (!instance) throw new ServiceError("This invitation has no approval workflow to decide.");

  const decisionResult = await recordWorkflowDecision(client, {
    workflowInstanceId: instance.id,
    decision: input.decision,
    comment: input.comment,
    actingUserId: input.actingUserId,
    actingUserRoleCodes: input.actingUserRoleCodes,
  });

  let invitation = await loadCurrent(client, input.invitationId);

  if (decisionResult.status === "approved") {
    const { data, error } = await client
      .from("invitations")
      .update({ status: "approved" })
      .eq("id", input.invitationId)
      .select("*")
      .single();
    if (error) {
      throw new ServiceError(
        "The invitation was fully approved, but its status could not be updated. Please contact an administrator.",
        error
      );
    }
    invitation = mapInvitationSummary(data);

    await createEventFromInvitation(client, {
      invitationId: invitation.id,
      name: invitation.eventName,
      eventDate: invitation.proposedDate,
      startTime: invitation.proposedTime,
      venue: invitation.venue,
      location: invitation.location,
    });
  } else if (decisionResult.status === "rejected") {
    const { data, error } = await client
      .from("invitations")
      .update({ status: "declined" })
      .eq("id", input.invitationId)
      .select("*")
      .single();
    if (error) throw new ServiceError("The invitation was declined, but its status could not be updated.", error);
    invitation = mapInvitationSummary(data);
  } else if (input.decision === "request_changes") {
    const { data, error } = await client
      .from("invitations")
      .update({ status: "pending_information" })
      .eq("id", input.invitationId)
      .select("*")
      .single();
    if (error) throw new ServiceError("Could not mark the invitation as pending information.", error);
    invitation = mapInvitationSummary(data);

    if (input.comment?.trim()) {
      await addComment(client, {
        ownerType: "invitation",
        ownerId: input.invitationId,
        authorId: input.actingUserId,
        body: input.comment.trim(),
        isInternal: false,
      });
    }
  }

  return { invitation, workflowStatus: decisionResult.status };
}
