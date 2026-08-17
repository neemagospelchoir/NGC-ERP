"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { ProcurementFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `expenseRequestId` is a real `<Select>` of approved expense requests —
 * a deliberate departure from this codebase's default paste-the-id
 * convention (see Expenses' own `departmentId`/`eventId`/
 * `supportingDocumentId` fields). Procurement's audience is Finance-only
 * (unlike self-service modules such as Expenses), and
 * `expenses.listExpenseRequests(client, { status: "approved" })` makes
 * enumerating the valid options cheap — see docs/PHASE_9_3.md §2.2 for
 * the full justification.
 */
export function ProcurementForm({
  action,
  expenseRequestOptions,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: ProcurementFormState, formData: FormData) => Promise<ProcurementFormState>;
  expenseRequestOptions: SelectOption[];
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select
        name="expenseRequestId"
        label="Approved expense request"
        options={expenseRequestOptions}
        placeholder="Select an approved expense request"
        hint={expenseRequestOptions.length === 0 ? "No approved expense requests are available yet." : undefined}
        required
      />
      <Textarea name="description" label="Description" required />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
