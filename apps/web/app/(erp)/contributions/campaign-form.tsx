"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Textarea } from "@ngc/ui";
import type { ContributionsFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function CampaignForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: ContributionsFormState, formData: FormData) => Promise<ContributionsFormState>;
  initial?: {
    name?: string;
    description?: string | null;
    targetAmount?: number | null;
    deadline?: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="name" label="Campaign name" defaultValue={initial?.name ?? ""} required />
      <Textarea name="description" label="Description" hint="Optional" defaultValue={initial?.description ?? ""} />
      <Input
        name="targetAmount"
        label="Target amount"
        type="number"
        min={0}
        step="0.01"
        hint="Optional — leave blank for an open-ended campaign"
        defaultValue={initial?.targetAmount ?? ""}
      />
      <Input name="deadline" label="Deadline" type="date" hint="Optional" defaultValue={initial?.deadline ?? ""} />
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
