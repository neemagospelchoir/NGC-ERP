"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Checkbox, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { MediaFormState } from "./actions";
import { LINK_TYPE_OPTIONS } from "./status";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `eventId`/`sharedWithDepartmentIds`/`sharedWithMemberIds` are plain
 * paste-the-id fields, the established convention (Announcements,
 * Notifications, Agenda & Voting) rather than a searchable picker.
 * `sharedWithRoles` is role CODES (e.g. `pro_spokesperson`), not IDs —
 * `media_links_select_scoped` RLS (0035) checks a caller's own role code
 * against this list directly.
 */
export function MediaLinkForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: MediaFormState, formData: FormData) => Promise<MediaFormState>;
  initial?: {
    linkType?: string;
    url?: string;
    title?: string | null;
    eventId?: string | null;
    sharedWithRoles?: string[];
    sharedWithDepartmentIds?: string[];
    sharedWithMemberIds?: string[];
    isPublished?: boolean;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="linkType" label="Link type" options={LINK_TYPE_OPTIONS as SelectOption[]} defaultValue={initial?.linkType ?? "youtube"} />
      <Input name="url" label="URL" type="url" defaultValue={initial?.url ?? ""} required />
      <Input name="title" label="Title" hint="Optional" defaultValue={initial?.title ?? ""} />
      <Input name="eventId" label="Event ID" hint="Optional — leave blank for media not tied to one specific event" defaultValue={initial?.eventId ?? ""} />
      <Textarea
        name="sharedWithRoles"
        label="Share with roles (before publishing)"
        hint="Optional — role codes, one per line or comma-separated, e.g. pro_spokesperson"
        defaultValue={(initial?.sharedWithRoles ?? []).join("\n")}
      />
      <Textarea
        name="sharedWithDepartmentIds"
        label="Share with department IDs (before publishing)"
        hint="Optional — one per line or comma-separated"
        defaultValue={(initial?.sharedWithDepartmentIds ?? []).join("\n")}
      />
      <Textarea
        name="sharedWithMemberIds"
        label="Share with member IDs (before publishing)"
        hint="Optional — one per line or comma-separated"
        defaultValue={(initial?.sharedWithMemberIds ?? []).join("\n")}
      />
      <Checkbox name="isPublished" label="Published (visible to everyone, including the public site)" defaultChecked={initial?.isPublished ?? false} />
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
