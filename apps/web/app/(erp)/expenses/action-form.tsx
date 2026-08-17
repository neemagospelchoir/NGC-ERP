"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { ExpenseFormState } from "./actions";
import { DECISION_OPTIONS } from "./status";

type BoundAction = (prevState: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** A single-button action with no extra input (e.g. "Submit for approval"). Mirrors gate-passes/action-form.tsx's SimpleActionForm. */
export function SimpleActionForm({ action, label, pendingLabel }: { action: BoundAction; label: string; pendingLabel: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton label={label} pendingLabel={pendingLabel} />
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
 * form to. Mirrors gate-passes/action-form.tsx's ApprovalDecisionForm.
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

export function MarkPaidForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input name="paymentReference" label="Payment reference" hint="Optional — receipt/transaction number" />
      <div>
        <SubmitButton label="Mark paid" pendingLabel="Recording…" />
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
