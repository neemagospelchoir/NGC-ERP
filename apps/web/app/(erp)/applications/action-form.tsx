"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Textarea } from "@ngc/ui";
import type { ApplicationActionState } from "./actions";

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** A single-button action with no extra input (e.g. "Move to pending review"). */
export function SimpleActionForm({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: (prevState: ApplicationActionState, formData: FormData) => Promise<ApplicationActionState>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "destructive" | "secondary";
}) {
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

/** An action gated behind a required (or optional) free-text reason/notes field — mark-incomplete and decide (approve/reject) all share this shape. */
export function ReasonActionForm({
  action,
  fieldName,
  fieldLabel,
  fieldHint,
  required,
  label,
  pendingLabel,
  variant,
}: {
  action: (prevState: ApplicationActionState, formData: FormData) => Promise<ApplicationActionState>;
  fieldName: string;
  fieldLabel: string;
  fieldHint?: string;
  required?: boolean;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "destructive" | "secondary";
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name={fieldName} label={fieldLabel} hint={fieldHint} required={required} />
      <div>
        <SubmitButton label={label} pendingLabel={pendingLabel} variant={variant} />
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
