"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Textarea } from "@ngc/ui";
import type { DepartmentFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function DepartmentForm({
  action,
  initialName,
  initialDescription,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: DepartmentFormState, formData: FormData) => Promise<DepartmentFormState>;
  initialName?: string;
  initialDescription?: string | null;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="name" label="Name" defaultValue={initialName} required />
      <Textarea name="description" label="Description" hint="Optional" defaultValue={initialDescription ?? ""} />
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
