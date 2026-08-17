"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { announcements } from "@ngc/services";
import type { AnnouncementFormState } from "./actions";
import { PRIORITY_OPTIONS, TARGET_AUDIENCE_OPTIONS } from "./status";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 16);
}

/**
 * `targetDepartmentId`/`targetFamilyId`/`attachmentDocumentId` are plain
 * paste-the-id fields, the established convention (docs/PHASE_9_2.md §1) —
 * `targetUserIds` is a newline/comma-separated textarea of ids rather than
 * a multi-select-with-search picker, the same simplification extended to a
 * list-of-ids field. `event_participants`/`leadership` are deliberately
 * absent from the audience Select — see status.ts's own doc comment.
 */
export function AnnouncementForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: AnnouncementFormState, formData: FormData) => Promise<AnnouncementFormState>;
  initial?: {
    title?: string;
    message?: string;
    imageUrl?: string | null;
    attachmentDocumentId?: string | null;
    targetAudience?: string;
    targetDepartmentId?: string | null;
    targetFamilyId?: string | null;
    targetUserIds?: string[];
    priority?: announcements.AnnouncementPriority;
    publishAt?: string;
    expiryAt?: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="title" label="Title" defaultValue={initial?.title ?? ""} required />
      <Textarea name="message" label="Message" defaultValue={initial?.message ?? ""} required />
      <Select
        name="targetAudience"
        label="Target audience"
        options={TARGET_AUDIENCE_OPTIONS as SelectOption[]}
        defaultValue={initial?.targetAudience ?? "all"}
      />
      <Input name="targetDepartmentId" label="Target department ID" hint="Optional — used when audience is a specific department" defaultValue={initial?.targetDepartmentId ?? ""} />
      <Input name="targetFamilyId" label="Target family ID" hint="Optional — used when audience is a specific family" defaultValue={initial?.targetFamilyId ?? ""} />
      <Textarea
        name="targetUserIds"
        label="Target user IDs"
        hint="Optional — one per line or comma-separated, used when audience is specific members"
        defaultValue={(initial?.targetUserIds ?? []).join("\n")}
      />
      <Select name="priority" label="Priority" options={PRIORITY_OPTIONS} defaultValue={initial?.priority ?? "normal"} />
      <Input name="imageUrl" label="Image URL" hint="Optional" defaultValue={initial?.imageUrl ?? ""} />
      <Input
        name="attachmentDocumentId"
        label="Attachment document ID"
        hint="Optional — paste a document's ID once the Documents module is available"
        defaultValue={initial?.attachmentDocumentId ?? ""}
      />
      <Input name="publishAt" label="Publish at" type="datetime-local" hint="Optional — defaults to now (published immediately)" defaultValue={toDatetimeLocal(initial?.publishAt)} />
      <Input name="expiryAt" label="Expires at" type="datetime-local" hint="Optional — never expires if left blank" defaultValue={toDatetimeLocal(initial?.expiryAt)} />
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
