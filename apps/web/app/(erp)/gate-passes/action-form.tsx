"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Checkbox, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { GatePassFormState } from "./actions";
import { DECISION_OPTIONS, RETURN_CONDITION_OPTIONS } from "./status";

type BoundAction = (prevState: GatePassFormState, formData: FormData) => Promise<GatePassFormState>;

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** A single-button action with no extra input (e.g. "Submit for approval"). Mirrors invitations/action-form.tsx's SimpleActionForm. */
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
 * `assetId` is a plain text field, not a name-search picker — same
 * deliberate, documented simplification as Assets' `targetId` field
 * (docs/PHASE_8_1.md §1). Adding an item here performs the actual
 * equipment-to-event assignment (add-item.ts) — the "override" checkbox
 * forwards straight to `inventory.assignAsset`'s own override flag.
 */
export function AddGatePassItemForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="assetId" label="Asset ID" hint="Paste the asset's ID from its own page" required />
      <Input name="quantity" label="Quantity" type="number" min={1} defaultValue={1} required />
      <Input name="expectedReturnAt" label="Expected return" type="datetime-local" hint="Optional" />
      <Checkbox name="override" label="Override — assign even though this asset isn't currently available" />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Add item" pendingLabel="Adding…" />
      </div>
    </form>
  );
}

/**
 * The current step's approver decides. Shown only to a user whose role
 * matches the pending step (see [id]/page.tsx's own gate) — a UI
 * convenience, not the authorization boundary: `record_workflow_decision`
 * (0028) re-verifies the same thing regardless of who the UI shows this
 * form to. Mirrors invitations/action-form.tsx's ApprovalDecisionForm.
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

export function ReturnGatePassItemForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select name="condition" label="Return condition" options={RETURN_CONDITION_OPTIONS as SelectOption[]} defaultValue="good" required />
      <div>
        <SubmitButton label="Record return" pendingLabel="Recording…" />
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
