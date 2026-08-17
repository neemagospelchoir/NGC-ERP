"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, type SelectOption } from "@ngc/ui";
import type { UniformFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `memberId`/`eventId` are plain text fields, not a name-search picker —
 * same deliberate, documented simplification as Assets' `targetId` field
 * (docs/PHASE_8_1.md §1): paste the id from that record's own page rather
 * than a full cross-module search-and-select control.
 */
export function AssignUniformForm({ action }: { action: (prevState: UniformFormState, formData: FormData) => Promise<UniformFormState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="memberId" label="Member ID" hint="Paste the member's ID from their own page" required />
      <Input name="eventId" label="Event ID" hint="Optional — leave blank for a standing/permanent issue" />
      <Input name="quantity" label="Quantity" type="number" min={1} defaultValue={1} required />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Issue" pendingLabel="Issuing…" />
      </div>
    </form>
  );
}

const RETURN_CONDITION_OPTIONS: SelectOption[] = [
  { value: "good", label: "Good — fully returned" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
];

export function ReturnUniformAssignmentForm({ action }: { action: (prevState: UniformFormState, formData: FormData) => Promise<UniformFormState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="returnCondition" label="Return condition" options={RETURN_CONDITION_OPTIONS} defaultValue="good" required />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Record return" pendingLabel="Recording…" />
      </div>
    </form>
  );
}
