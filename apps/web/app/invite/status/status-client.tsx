"use client";

import { useRef, useState, useTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, CardHeader, CardTitle, Input, StatusPill, Textarea } from "@ngc/ui";
import type { invitations } from "@ngc/services";
import { loadInvitationAction, resubmitInvitationAction, type ResubmitInvitationState } from "../actions";

interface Credentials {
  invitationNumber: string;
  accessToken: string;
  verificationContact: string;
}

const STATUS_LABEL: Record<invitations.InvitationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted — awaiting review",
  received: "Received",
  under_review: "Under review",
  pending_information: "More information needed",
  pending_management_approval: "Pending management approval",
  approved: "Approved",
  declined: "Not approved",
  cancelled: "Cancelled",
  completed: "Completed",
  postponed: "Postponed",
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Same "call the action directly, outside useActionState" rationale as apps/web/app/join/continue/continue-client.tsx's VerifyForm — see that file's doc comment. */
function VerifyForm({ onVerified }: { onVerified: (creds: Credentials, view: invitations.OrganizerViewResult) => void }) {
  const [invitationNumber, setInvitationNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verificationContact, setVerificationContact] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const creds: Credentials = { invitationNumber, accessToken, verificationContact };
    startTransition(async () => {
      const formData = new FormData();
      formData.set("invitationNumber", creds.invitationNumber);
      formData.set("accessToken", creds.accessToken);
      formData.set("verificationContact", creds.verificationContact);
      const result = await loadInvitationAction({}, formData);
      if (!result.view) {
        setError(result.error ?? "Could not verify that invitation.");
        return;
      }
      onVerified(creds, result.view);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Invitation number" placeholder="INV-2026-0001" value={invitationNumber} onChange={(e) => setInvitationNumber(e.target.value)} required />
      <Input label="Access code" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required />
      <Input
        label="Email or phone number used at submission"
        value={verificationContact}
        onChange={(e) => setVerificationContact(e.target.value)}
        required
      />
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Checking…" : "Check status"}
      </Button>
    </form>
  );
}

function HiddenCredentialFields({ creds }: { creds: Credentials }) {
  return (
    <>
      <input type="hidden" name="invitationNumber" value={creds.invitationNumber} />
      <input type="hidden" name="accessToken" value={creds.accessToken} />
      <input type="hidden" name="verificationContact" value={creds.verificationContact} />
    </>
  );
}

function InvitationStatusView({ creds, initialView }: { creds: Credentials; initialView: invitations.OrganizerViewResult }) {
  const [resubmitState, resubmitAction] = useActionState<ResubmitInvitationState, FormData>(resubmitInvitationAction, {});
  const lastView = useRef(resubmitState.view);
  const [view, setView] = useState(initialView);
  if (resubmitState.view !== lastView.current) {
    lastView.current = resubmitState.view;
    if (resubmitState.view) setView(resubmitState.view);
  }

  const { invitation, visibleComments } = view;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Invitation {invitation.invitationNumber}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-2">
          <StatusPill tone={invitation.status === "pending_information" ? "warning" : "neutral"} label={STATUS_LABEL[invitation.status]} />
          <p className="text-sm text-ink-secondary">
            {invitation.eventName} — {new Date(invitation.proposedDate).toLocaleDateString()}
          </p>
        </div>
        {visibleComments.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-ink-primary">Notes from our team</p>
            <ul className="flex flex-col gap-2">
              {visibleComments.map((c) => (
                <li key={c.id} className="rounded-md border border-hairline bg-surface-plane p-3 text-sm text-ink-secondary">
                  {c.body}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {invitation.status === "pending_information" && (
        <Card>
          <CardHeader>
            <CardTitle>Update your invitation</CardTitle>
          </CardHeader>
          <form action={resubmitAction} className="flex flex-col gap-4">
            <HiddenCredentialFields creds={creds} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input name="organizerName" label="Your name" defaultValue={invitation.organizerName} required />
              <Input name="organizationName" label="Organization / church name" defaultValue={invitation.organizationName ?? ""} />
              <Input name="eventName" label="Event name" defaultValue={invitation.eventName} required />
              <Input name="proposedDate" type="date" label="Proposed date" defaultValue={invitation.proposedDate} required />
              <Input name="proposedTime" type="time" label="Proposed time" defaultValue={invitation.proposedTime ?? ""} />
              <Input name="venue" label="Venue" defaultValue={invitation.venue ?? ""} />
              <Input name="location" label="Location" defaultValue={invitation.location ?? ""} />
              <Input name="expectedAudience" type="number" min="0" label="Expected audience" defaultValue={invitation.expectedAudience ?? ""} />
            </div>
            <Textarea name="technicalRequirements" label="Technical requirements" defaultValue={invitation.technicalRequirements ?? ""} />
            <Textarea name="additionalNotes" label="Additional notes" defaultValue={invitation.additionalNotes ?? ""} />
            {resubmitState.error && (
              <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
                <span aria-hidden="true">⚠</span>
                {resubmitState.error}
              </p>
            )}
            <div>
              <SubmitButton label="Resubmit" pendingLabel="Resubmitting…" />
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function StatusClient() {
  const [state, setState] = useState<{ creds: Credentials; view: invitations.OrganizerViewResult } | null>(null);

  if (!state) {
    return <VerifyForm onVerified={(creds, view) => setState({ creds, view })} />;
  }
  return <InvitationStatusView creds={state.creds} initialView={state.view} />;
}
