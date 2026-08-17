"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Checkbox, Input, Select, Textarea } from "@ngc/ui";
import type { notifications } from "@ngc/services";
import type { TemplateFormState } from "./actions";
import { CHANNEL_OPTIONS } from "./status";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `defaultChannels` (an array column) is simplified to a single "Default
 * channel" Select here — the composer (`notification-form.tsx`) still lets
 * whoever sends a notification pick any channel per-send regardless of a
 * template's own default, so this simplification only affects what a new
 * ad hoc send pre-fills toward, not what channels are actually usable.
 */
export function TemplateForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
  showActiveToggle,
}: {
  action: (prevState: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  initial?: {
    code?: string;
    name?: string;
    channelSubject?: string | null;
    bodyTemplate?: string;
    defaultChannels?: notifications.NotificationChannel[];
    isActive?: boolean;
  };
  submitLabel: string;
  pendingLabel: string;
  showActiveToggle?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="code" label="Code" hint="A short, unique identifier, e.g. rehearsal_reminder" defaultValue={initial?.code ?? ""} required />
      <Input name="name" label="Name" defaultValue={initial?.name ?? ""} required />
      <Input name="channelSubject" label="Email subject" hint="Optional" defaultValue={initial?.channelSubject ?? ""} />
      <Textarea
        name="bodyTemplate"
        label="Body template"
        hint="Supports {{placeholders}}"
        defaultValue={initial?.bodyTemplate ?? ""}
        required
      />
      <Select name="defaultChannel" label="Default channel" options={CHANNEL_OPTIONS} defaultValue={initial?.defaultChannels?.[0] ?? "in_app"} />
      {showActiveToggle && <Checkbox name="isActive" label="Active" defaultChecked={initial?.isActive ?? true} />}
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
