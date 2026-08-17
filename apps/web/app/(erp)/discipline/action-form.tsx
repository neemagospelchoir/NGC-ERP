"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { DisciplineActionState } from "./actions";
import type { discipline } from "@ngc/services";
import { ACTION_TYPE_OPTIONS } from "./status";

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** A single-button action with no extra input (e.g. "Begin investigation", "Resolve case"). Mirrors applications/action-form.tsx's SimpleActionForm. */
export function SimpleActionForm({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: (prevState: DisciplineActionState, formData: FormData) => Promise<DisciplineActionState>;
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

/**
 * Records a disciplinary action. The suspension start/end date fields only
 * render when "Suspension" is selected — client-side only (no server
 * round-trip needed to know which fields apply), but the real requirement
 * (a suspension needs a start date) is still enforced server-side in
 * recordAction() regardless of what this form shows, per this codebase's
 * "UI is a nicety, RLS/the service layer is the real gate" discipline.
 */
export function RecordActionForm({ action }: { action: (prevState: DisciplineActionState, formData: FormData) => Promise<DisciplineActionState> }) {
  const [state, formAction] = useActionState(action, {});
  const [actionType, setActionType] = useState<discipline.ActionType>("warning");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select
        name="actionType"
        label="Action type"
        options={ACTION_TYPE_OPTIONS as SelectOption[]}
        defaultValue="warning"
        onChange={(e) => setActionType(e.target.value as discipline.ActionType)}
        required
      />
      {actionType === "suspension" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="suspensionStartDate" type="date" label="Suspension start" required />
          <Input name="suspensionEndDate" type="date" label="Suspension end" hint="Optional — open-ended until restored" />
        </div>
      )}
      <Textarea name="resolution" label="Resolution / notes" hint="Optional" />
      <div>
        <SubmitButton label="Record action" pendingLabel="Recording…" variant={actionType === "dismissal" ? "destructive" : "primary"} />
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

export function RestoreSuspensionForm({ action }: { action: (prevState: DisciplineActionState, formData: FormData) => Promise<DisciplineActionState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name="restorationReason" label="Restoration reason" required />
      <div>
        <SubmitButton label="Restore" pendingLabel="Restoring…" />
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
