"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Textarea } from "@ngc/ui";
import type { technicalRiders } from "@ngc/services";
import type { TechnicalRiderFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * One form covers every rider field the schema has (0009) — PA, lighting,
 * LED, camera, recording, power, stage, monitoring, crew notes,
 * setup/soundcheck time, and general technical notes. `eventId` is a plain
 * pasted-ID field only when creating (no existing rider); on the edit page
 * it is fixed (bound server-side into the action) and not re-collected from
 * the form, matching this codebase's "paste the ID" convention for
 * cross-module references (docs/PHASE_8_1.md §1) without letting an edit
 * accidentally retarget a different event.
 */
export function TechnicalRiderForm({
  action,
  rider,
  showEventIdField = false,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: TechnicalRiderFormState, formData: FormData) => Promise<TechnicalRiderFormState>;
  rider?: technicalRiders.TechnicalRider;
  showEventIdField?: boolean;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {showEventIdField && <Input name="eventId" label="Event ID" hint="Paste the event's ID from its own page" required />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="setupTime" label="Setup time" type="datetime-local" defaultValue={rider?.setupTime ?? undefined} />
        <Input name="soundcheckTime" label="Soundcheck time" type="datetime-local" defaultValue={rider?.soundcheckTime ?? undefined} />
      </div>
      <Textarea name="paRequirements" label="PA requirements" defaultValue={rider?.paRequirements ?? undefined} />
      <Textarea name="lightingRequirements" label="Lighting requirements" defaultValue={rider?.lightingRequirements ?? undefined} />
      <Textarea name="ledDisplayRequirements" label="LED display requirements" defaultValue={rider?.ledDisplayRequirements ?? undefined} />
      <Textarea name="cameraRequirements" label="Camera requirements" defaultValue={rider?.cameraRequirements ?? undefined} />
      <Textarea name="recordingRequirements" label="Recording requirements" defaultValue={rider?.recordingRequirements ?? undefined} />
      <Textarea name="powerRequirements" label="Power requirements" defaultValue={rider?.powerRequirements ?? undefined} />
      <Textarea name="stageRequirements" label="Stage requirements" defaultValue={rider?.stageRequirements ?? undefined} />
      <Textarea name="monitoringRequirements" label="Monitoring requirements" defaultValue={rider?.monitoringRequirements ?? undefined} />
      <Textarea name="crewNotes" label="Crew notes" defaultValue={rider?.crewNotes ?? undefined} />
      <Textarea name="technicalNotes" label="General technical notes" defaultValue={rider?.technicalNotes ?? undefined} />
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
