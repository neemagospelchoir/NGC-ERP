import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, comments as commentsService, events, invitations, workflow } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import {
  advanceInvitationStatusAction,
  addInvitationCommentAction,
  cancelInvitationAction,
  recordInvitationApprovalDecisionAction,
  requestInvitationInformationAction,
  startInvitationApprovalAction,
} from "../actions";
import { AddCommentForm, ApprovalDecisionForm, CancelInvitationForm, RequestInformationForm, SimpleActionForm } from "../action-form";
import { invitationStatusLabel, invitationStatusTone } from "../status";

export const metadata: Metadata = { title: "Invitation — NGC ERP" };

const READ_PERMISSION = "events.invitations.read";
const MANAGE_PERMISSION = "events.invitations.manage";

function FieldGrid({ fields }: { fields: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
          <dd className="text-sm text-ink-primary">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const CANCELLABLE_STATUSES = new Set(["submitted", "received", "under_review", "pending_information", "pending_management_approval"]);

export default async function InvitationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser?.permissionCodes.includes(READ_PERMISSION) || currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Invitation" breadcrumb={["NGC ERP", "Invitations"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view invitations.</p>
        </Card>
      </>
    );
  }

  const invitation = await invitations.getInvitation(supabase, params.id);
  if (!invitation) notFound();

  const [instance, commentRows, event] = await Promise.all([
    workflow.getWorkflowForRecord(supabase, "invitation", invitation.id),
    commentsService.listComments(supabase, "invitation", invitation.id),
    events.getEventByInvitationId(supabase, invitation.id),
  ]);
  const decisions = instance ? await workflow.listWorkflowDecisions(supabase, instance.id) : [];

  const isCurrentApprover = Boolean(
    instance &&
      instance.status === "pending" &&
      currentUser &&
      workflow.isCurrentStepFor(instance, { id: currentUser.id, roleCodes: currentUser.roles.map((r) => r.code) })
  );

  const boundMarkReceived = advanceInvitationStatusAction.bind(null, invitation.id, "received");
  const boundStartReview = advanceInvitationStatusAction.bind(null, invitation.id, "under_review");
  const boundComplete = advanceInvitationStatusAction.bind(null, invitation.id, "completed");
  const boundPostpone = advanceInvitationStatusAction.bind(null, invitation.id, "postponed");
  const boundResume = advanceInvitationStatusAction.bind(null, invitation.id, "approved");
  const boundRequestInfo = requestInvitationInformationAction.bind(null, invitation.id);
  const boundStartApproval = startInvitationApprovalAction.bind(null, invitation.id);
  const boundCancel = cancelInvitationAction.bind(null, invitation.id);
  const boundAddComment = addInvitationCommentAction.bind(null, invitation.id);
  const boundDecide = recordInvitationApprovalDecisionAction.bind(null, invitation.id);

  return (
    <>
      <PageHeader
        title={invitation.invitationNumber}
        breadcrumb={["NGC ERP", "Invitations", invitation.eventName]}
        action={<StatusPill tone={invitationStatusTone(invitation.status)} label={invitationStatusLabel(invitation.status)} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organizer & event</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Organizer", invitation.organizerName],
                ["Organization", invitation.organizationName ?? ""],
                ["Contact email", invitation.organizerContactEmail ?? ""],
                ["Contact phone", invitation.organizerContactPhone ?? ""],
                ["Event name", invitation.eventName],
                ["Event type", invitation.eventType ?? ""],
                ["Proposed date", new Date(invitation.proposedDate).toLocaleDateString()],
                ["Proposed time", invitation.proposedTime ?? ""],
                ["Venue", invitation.venue ?? ""],
                ["Location", invitation.location ?? ""],
                ["Region", invitation.region ?? ""],
                ["Expected audience", invitation.expectedAudience != null ? String(invitation.expectedAudience) : ""],
              ]}
            />
            {event && (
              <p className="mt-4 text-sm">
                <Link href={`/events/${event.id}`} className="font-medium text-brand-700 hover:underline">
                  View event →
                </Link>
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements & notes</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3 text-sm">
              <p><span className="font-medium text-ink-primary">Nature of invitation: </span><span className="text-ink-secondary">{invitation.natureOfInvitation || "—"}</span></p>
              <p><span className="font-medium text-ink-primary">Performance requirements: </span><span className="text-ink-secondary">{invitation.performanceRequirements || "—"}</span></p>
              <p><span className="font-medium text-ink-primary">Technical requirements: </span><span className="text-ink-secondary">{invitation.technicalRequirements || "—"}</span></p>
              <p><span className="font-medium text-ink-primary">Transport requirements: </span><span className="text-ink-secondary">{invitation.transportRequirements || "—"}</span></p>
              <p><span className="font-medium text-ink-primary">Accommodation requirements: </span><span className="text-ink-secondary">{invitation.accommodationRequirements || "—"}</span></p>
              <p><span className="font-medium text-ink-primary">Financial information: </span><span className="text-ink-secondary">{invitation.financialInformation || "—"}</span></p>
              <p><span className="font-medium text-ink-primary">Additional notes: </span><span className="text-ink-secondary">{invitation.additionalNotes || "—"}</span></p>
            </div>
          </Card>

          {instance && (
            <Card>
              <CardHeader>
                <CardTitle>Approval chain — {instance.definitionName}</CardTitle>
              </CardHeader>
              {decisions.length === 0 ? (
                <p className="text-sm text-ink-secondary">No decisions recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {decisions.map((d) => (
                    <li key={d.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-ink-primary">
                        Step {d.stepOrder} ({d.approverRoleCode ?? "assigned approver"}) — {d.decision.replace("_", " ")}
                      </p>
                      <p className="text-xs text-ink-muted">{new Date(d.decidedAt).toLocaleString()}</p>
                      {d.comment && <p className="mt-1 text-sm text-ink-secondary">{d.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {instance.status === "pending" && (
                <p className="mt-3 text-sm text-ink-secondary">
                  Currently awaiting step {instance.currentStepOrder}
                  {instance.currentStepRoleCode ? ` (${instance.currentStepRoleCode})` : ""}.
                </p>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            {commentRows.length === 0 ? (
              <p className="mb-4 text-sm text-ink-secondary">No comments yet.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-3">
                {commentRows.map((c) => (
                  <li key={c.id} className="rounded-md border border-hairline bg-surface-plane p-3 text-sm text-ink-secondary">
                    <p>{c.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {new Date(c.createdAt).toLocaleString()} {!c.isInternal && "— visible to organizer"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <AddCommentForm action={boundAddComment} />
          </Card>
        </div>

        {canManage && (
          <div className="flex flex-col gap-6">
            {invitation.status === "submitted" && (
              <Card>
                <CardHeader>
                  <CardTitle>Mark received</CardTitle>
                </CardHeader>
                <SimpleActionForm action={boundMarkReceived} label="Mark received" pendingLabel="Updating…" />
              </Card>
            )}

            {invitation.status === "received" && (
              <Card>
                <CardHeader>
                  <CardTitle>Start review</CardTitle>
                </CardHeader>
                <SimpleActionForm action={boundStartReview} label="Start review" pendingLabel="Updating…" />
              </Card>
            )}

            {invitation.status === "under_review" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Request more information</CardTitle>
                  </CardHeader>
                  <RequestInformationForm action={boundRequestInfo} />
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Start approval</CardTitle>
                  </CardHeader>
                  <p className="mb-3 text-sm text-ink-secondary">Begins the configured approval chain (default: Secretary → Technical → Finance → Chairman).</p>
                  <SimpleActionForm action={boundStartApproval} label="Start approval" pendingLabel="Starting…" />
                </Card>
              </>
            )}

            {invitation.status === "approved" && (
              <Card>
                <CardHeader>
                  <CardTitle>After approval</CardTitle>
                </CardHeader>
                <div className="flex flex-col gap-3">
                  <SimpleActionForm action={boundComplete} label="Mark completed" pendingLabel="Updating…" />
                  <SimpleActionForm action={boundPostpone} label="Postpone" pendingLabel="Updating…" variant="secondary" />
                </div>
              </Card>
            )}

            {invitation.status === "postponed" && (
              <Card>
                <CardHeader>
                  <CardTitle>Resume</CardTitle>
                </CardHeader>
                <SimpleActionForm action={boundResume} label="Resume as approved" pendingLabel="Updating…" />
              </Card>
            )}

            {CANCELLABLE_STATUSES.has(invitation.status) && (
              <Card>
                <CardHeader>
                  <CardTitle>Cancel</CardTitle>
                </CardHeader>
                <CancelInvitationForm action={boundCancel} />
              </Card>
            )}
          </div>
        )}

        {isCurrentApprover && (
          <div className="flex flex-col gap-6 lg:col-start-2">
            <Card>
              <CardHeader>
                <CardTitle>Your decision</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                You hold the {instance?.currentStepRoleCode} role and this invitation is awaiting your decision.
              </p>
              <ApprovalDecisionForm action={boundDecide} />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
