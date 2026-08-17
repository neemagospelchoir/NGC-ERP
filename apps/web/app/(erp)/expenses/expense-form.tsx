"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { ExpenseFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `departmentId`/`eventId`/`supportingDocumentId` are plain paste-the-id
 * text fields, not name-search pickers — the same established
 * simplification as every other cross-module reference in this codebase
 * (docs/PHASE_8_1.md §1). `supportingDocumentId` is the FIRST field of
 * this shape this codebase's UI actually wires up end-to-end — Leave's
 * equivalent (`leave_requests.supporting_document_id`) was silently never
 * given a form field by any phase (see packages/services/src/expenses/
 * types.ts's own doc comment).
 */
export function ExpenseForm({
  action,
  categoryOptions,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;
  categoryOptions: SelectOption[];
  initial?: {
    description?: string;
    amount?: number;
    category?: string | null;
    departmentId?: string | null;
    eventId?: string | null;
    supportingDocumentId?: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Textarea name="description" label="Description" defaultValue={initial?.description ?? ""} required />
      <Input name="amount" label="Amount" type="number" min={0} step="0.01" defaultValue={initial?.amount ?? ""} required />
      <Select
        name="category"
        label="Category"
        options={categoryOptions}
        defaultValue={initial?.category ?? ""}
        placeholder="Select a category"
        hint="Optional"
      />
      <Input name="departmentId" label="Department ID" hint="Optional — paste from that department's own page" defaultValue={initial?.departmentId ?? ""} />
      <Input name="eventId" label="Event ID" hint="Optional — paste from that event's own page" defaultValue={initial?.eventId ?? ""} />
      <Input
        name="supportingDocumentId"
        label="Supporting document ID"
        hint="Optional — paste a document's ID (e.g. a receipt) once the Documents module is available"
        defaultValue={initial?.supportingDocumentId ?? ""}
      />
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
