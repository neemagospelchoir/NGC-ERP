"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input } from "@ngc/ui";
import type { GatePassFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `eventId`/`personResponsibleId`/`departmentId` are plain text fields, not
 * name-search pickers — the same deliberate, documented simplification as
 * Assets' `targetId` field (docs/PHASE_8_1.md §1): paste the ID from that
 * record's own page. `personResponsibleId` defaults to the signed-in
 * creator (via `defaultValue`), since that is the common case, but stays
 * editable for when someone else is being sent with the equipment.
 */
export function GatePassForm({
  action,
  defaultPersonResponsibleId,
}: {
  action: (prevState: GatePassFormState, formData: FormData) => Promise<GatePassFormState>;
  defaultPersonResponsibleId?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="eventId" label="Event ID" hint="Paste the event's ID from its own page" required />
      <Input
        name="personResponsibleId"
        label="Person responsible (user ID)"
        hint="Defaults to you — change if someone else is carrying this pass"
        defaultValue={defaultPersonResponsibleId}
        required
      />
      <Input name="departmentId" label="Department ID" hint="Optional" />
      <Input name="expectedDeparture" label="Expected departure" type="datetime-local" hint="Optional" />
      <Input name="expectedReturn" label="Expected return" type="datetime-local" hint="Optional" />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Create gate pass" pendingLabel="Creating…" />
      </div>
    </form>
  );
}
