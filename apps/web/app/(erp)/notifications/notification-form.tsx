"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { NotificationFormState } from "./actions";
import { AUDIENCE_OPTIONS, CHANNEL_OPTIONS } from "./status";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send notification"}
    </Button>
  );
}

/**
 * `templateId`/`departmentId`/`familyId` are plain paste-the-id fields, the
 * established convention. Only `all`/`department`/`family`/`specific_users`
 * are offered as audiences — see `send.ts`'s own doc comment for why
 * `event_participants`/`leadership` have no resolvable membership list in
 * this codebase today and are deliberately left out rather than accepted
 * and silently resolved to nobody.
 */
export function NotificationForm({
  action,
  templateOptions,
}: {
  action: (prevState: NotificationFormState, formData: FormData) => Promise<NotificationFormState>;
  templateOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select
        name="templateId"
        label="Template"
        options={templateOptions}
        placeholder="No template — ad hoc message"
        hint="Optional"
      />
      <Select name="audience" label="Audience" options={AUDIENCE_OPTIONS as SelectOption[]} defaultValue="all" />
      <Input name="departmentId" label="Department ID" hint="Required when audience is a specific department" />
      <Input name="familyId" label="Family ID" hint="Required when audience is a specific family" />
      <Textarea name="userIds" label="User IDs" hint="Required when audience is specific users — one per line or comma-separated" />
      <Select name="channel" label="Channel" options={CHANNEL_OPTIONS} defaultValue="in_app" />
      <Input name="subject" label="Subject" hint="Optional — used for email" />
      <Textarea name="body" label="Message" required />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      {typeof state.recipientCount === "number" && !state.error && (
        <p className="text-sm text-status-good">
          Sent to {state.recipientCount} recipient{state.recipientCount === 1 ? "" : "s"}.
        </p>
      )}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
