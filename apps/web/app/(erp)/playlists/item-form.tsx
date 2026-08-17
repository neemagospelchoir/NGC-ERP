"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input } from "@ngc/ui";
import type { playlists } from "@ngc/services";
import type { PlaylistFormState } from "./actions";

type BoundAction = (prevState: PlaylistFormState, formData: FormData) => Promise<PlaylistFormState>;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `leadVocalMemberId`/`backingVocalMemberIds` are plain pasted-ID fields
 * (the latter comma-separated), not a member-search picker — the same
 * deliberate simplification as Gate Passes' `assetId` field
 * (docs/PHASE_8_1.md §1, docs/PHASE_8_3.md §1).
 */
export function PlaylistItemForm({
  action,
  item,
  nextSequenceNumber,
  submitLabel,
  pendingLabel,
}: {
  action: BoundAction;
  item?: playlists.PlaylistItem;
  nextSequenceNumber?: number;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="sequenceNumber"
          label="Sequence #"
          type="number"
          min={1}
          defaultValue={item?.sequenceNumber ?? nextSequenceNumber ?? 1}
          required
        />
        <Input name="durationSeconds" label="Duration (seconds)" type="number" min={0} defaultValue={item?.durationSeconds ?? undefined} />
      </div>
      <Input name="songTitle" label="Song title" defaultValue={item?.songTitle} required />
      <div className="grid grid-cols-2 gap-3">
        <Input name="musicalKey" label="Key" defaultValue={item?.musicalKey ?? undefined} />
        <Input name="instrument" label="Instrument" defaultValue={item?.instrument ?? undefined} />
      </div>
      <Input name="leadVocalMemberId" label="Lead vocal (member ID)" hint="Optional" defaultValue={item?.leadVocalMemberId ?? undefined} />
      <Input
        name="backingVocalMemberIds"
        label="Backing vocals (member IDs)"
        hint="Comma-separated, optional"
        defaultValue={item?.backingVocalMemberIds.join(",")}
      />
      <Input name="technicalNotes" label="Technical notes" hint="Optional" defaultValue={item?.technicalNotes ?? undefined} />
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
