"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input } from "@ngc/ui";
import type { PlaylistFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function CreatePlaylistForm({
  action,
}: {
  action: (prevState: PlaylistFormState, formData: FormData) => Promise<PlaylistFormState>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="eventId" label="Event ID" hint="Paste the event's ID from its own page" required />
      <Input name="title" label="Title" hint="Optional — defaults to “Event Playlist”" />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Create playlist" pendingLabel="Creating…" />
      </div>
    </form>
  );
}

/**
 * `sharedWithRoles` is a comma-separated list of role codes typed as plain
 * text, not a multi-select of live roles — consistent with this codebase's
 * "paste the ID/code" simplification elsewhere, and see this field's own
 * doc comment in `types.ts` for why editing it does not change what RLS
 * actually enforces.
 */
export function EditPlaylistForm({
  action,
  title,
  sharedWithRoles,
}: {
  action: (prevState: PlaylistFormState, formData: FormData) => Promise<PlaylistFormState>;
  title: string;
  sharedWithRoles: string[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="title" label="Title" defaultValue={title} required />
      <Input
        name="sharedWithRoles"
        label="Shared with roles"
        hint="Comma-separated role codes, e.g. secretary,chairman"
        defaultValue={sharedWithRoles.join(",")}
      />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Save changes" pendingLabel="Saving…" />
      </div>
    </form>
  );
}
