"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Textarea } from "@ngc/ui";
import type { ProbationActionState } from "./actions";

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Shared shape for "complete probation" (notes optional) and "fail probation" (notes required) — mirrors apps/web/app/(erp)/applications/action-form.tsx's ReasonActionForm. */
export function ProbationDecisionForm({
  action,
  fieldLabel,
  fieldHint,
  required,
  label,
  pendingLabel,
  variant,
}: {
  action: (prevState: ProbationActionState, formData: FormData) => Promise<ProbationActionState>;
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
      <Textarea name="outcomeNotes" label={fieldLabel} hint={fieldHint} required={required} />
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
