"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, Input, Textarea } from "@ngc/ui";
import { submitInvitationAction, type SubmitInvitationState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit invitation"}
    </Button>
  );
}

/**
 * A single-shot public submission (PRD §7.24) — unlike /join, there is no
 * save-progress step here (see packages/services/src/invitations/
 * submit.ts's doc comment for why). The Invitation number + access token
 * shown on success are the organizer's ENTIRE credential for checking
 * status later — same blunt "save this now" pattern as /join's StartForm.
 */
export function InviteForm() {
  const [state, formAction] = useActionState<SubmitInvitationState, FormData>(submitInvitationAction, {});
  const [copied, setCopied] = useState(false);

  if (state.result) {
    const credentialsText = `Invitation number: ${state.result.invitationNumber}\nAccess code: ${state.result.accessToken}`;
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 p-4">
          <p className="mb-2 text-sm font-semibold text-ink-primary">Save this information now — it will not be shown again.</p>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Invitation number</dt>
              <dd className="font-mono text-ink-primary">{state.result.invitationNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Access code</dt>
              <dd className="break-all font-mono text-ink-primary">{state.result.accessToken}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(credentialsText);
              setCopied(true);
            }}
            className="mt-3 text-sm font-medium text-brand-700 hover:underline"
          >
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
        <p className="text-sm text-ink-secondary">
          Thank you — our team will review this and follow up. You&apos;ll need the invitation number, access code, and
          the email/phone you just entered to check its status.
        </p>
        <Link href="/invite/status">
          <Button>Check invitation status</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="organizerName" label="Your name" required />
        <Input name="organizationName" label="Organization / church name" />
        <Input name="organizerContactEmail" label="Email" type="email" />
        <Input name="organizerContactPhone" label="Phone" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="eventName" label="Event name" required />
        <Input name="eventType" label="Event type" hint="e.g. Worship Service, Concert, Crusade, Wedding, TV Recording" />
        <Input name="proposedDate" type="date" label="Proposed date" required />
        <Input name="proposedTime" type="time" label="Proposed time" />
        <Input name="venue" label="Venue" />
        <Input name="location" label="Location" />
        <Input name="region" label="Region" />
        <Input name="expectedAudience" type="number" min="0" label="Expected audience" />
      </div>

      <Textarea name="natureOfInvitation" label="Nature of the invitation" hint="What is being requested of the choir" />
      <Textarea name="performanceRequirements" label="Performance requirements" />
      <Textarea name="technicalRequirements" label="Technical requirements" hint="PA, mics, instruments, lighting, recording, power, etc." />
      <Textarea name="transportRequirements" label="Transport requirements" />
      <Textarea name="accommodationRequirements" label="Accommodation requirements" />
      <Textarea name="financialInformation" label="Financial information" hint="Honorarium, budget, or any financial terms offered" />
      <Textarea name="additionalNotes" label="Additional notes" />

      <Input
        name="verificationContact"
        label="Your email or phone number"
        hint="You'll use this alongside your access code every time you check this invitation's status"
        required
      />

      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
