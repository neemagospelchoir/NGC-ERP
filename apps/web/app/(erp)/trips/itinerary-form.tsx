"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Textarea } from "@ngc/ui";
import type { itineraries } from "@ngc/services";
import type { TripFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `assignedMemberIds` is a comma-separated plain-text field, not a
 * member-search multi-select — the same simplification as Playlists'
 * `backingVocalMemberIds` (docs/PHASE_8_4.md).
 */
export function ItineraryForm({
  action,
  itinerary,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: TripFormState, formData: FormData) => Promise<TripFormState>;
  itinerary?: itineraries.Itinerary;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        name="assignedMemberIds"
        label="Assigned members (member IDs)"
        hint="Comma-separated, optional"
        defaultValue={itinerary?.assignedMemberIds.join(",")}
      />
      <Textarea name="notes" label="Notes" defaultValue={itinerary?.notes ?? undefined} />
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
