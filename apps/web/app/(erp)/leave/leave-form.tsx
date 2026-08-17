"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea } from "@ngc/ui";
import type { LeaveActionState } from "./actions";
import { LEAVE_TYPE_OPTIONS } from "./status";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit request"}
    </Button>
  );
}

export function LeaveCreateForm({
  action,
}: {
  action: (prevState: LeaveActionState, formData: FormData) => Promise<LeaveActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="leaveType" label="Leave type" options={LEAVE_TYPE_OPTIONS} defaultValue="planned" required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="startDate" type="date" label="Start date" required />
        <Input name="endDate" type="date" label="End date" required />
      </div>
      <Textarea name="reason" label="Reason" required />
      <div>
        <SubmitButton />
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

function DecideSubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "primary" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function LeaveDecideForm({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: (prevState: LeaveActionState, formData: FormData) => Promise<LeaveActionState>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "destructive" | "secondary";
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name="comment" label="Comment" hint="Optional" />
      <div>
        <DecideSubmitButton label={label} pendingLabel={pendingLabel} variant={variant} />
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
