"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { InvitationActionState } from "./actions";
import { DECISION_OPTIONS } from "./status";

type BoundAction = (prevState: InvitationActionState, formData: FormData) => Promise<InvitationActionState>;

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** A single-button action with no extra input (e.g. "Mark received", "Start approval"). Mirrors discipline/action-form.tsx's SimpleActionForm. */
export function SimpleActionForm({ action, label, pendingLabel, variant }: { action: BoundAction; label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton label={label} pendingLabel={pendingLabel} variant={variant} />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}

export function RequestInformationForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name="note" label="What does the organizer need to provide or fix?" hint="Shown to the organizer on their status page" required />
      <div>
        <SubmitButton label="Request information" pendingLabel="Sending…" />
      </div>
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}

export function CancelInvitationForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name="reason" label="Cancellation reason" required />
      <div>
        <SubmitButton label="Cancel invitation" pendingLabel="Cancelling…" variant="destructive" />
      </div>
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}

export function AddCommentForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name="body" label="Add an internal comment" required />
      <div>
        <SubmitButton label="Post comment" pendingLabel="Posting…" />
      </div>
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * The current step's approver decides. Shown only to a user whose role
 * matches the pending step (see [id]/page.tsx's own gate) — a UI
 * convenience, not the authorization boundary: `record_workflow_decision`
 * (0028) re-verifies the same thing regardless of who the UI shows this
 * form to.
 */
export function ApprovalDecisionForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select name="decision" label="Decision" options={DECISION_OPTIONS as SelectOption[]} defaultValue="approve" required />
      <Textarea name="comment" label="Comment" hint="Required when requesting changes" />
      <div>
        <SubmitButton label="Submit decision" pendingLabel="Submitting…" />
      </div>
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}
