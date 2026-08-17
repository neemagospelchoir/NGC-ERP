"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Textarea } from "@ngc/ui";
import type { trips } from "@ngc/services";
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
 * `transportVendorId`/`accommodationVendorId` are plain pasted-ID fields
 * (paste the vendor's ID from `/vendors`), the same deliberate
 * simplification as every prior Phase 8 cross-module reference
 * (docs/PHASE_8_1.md §1, docs/PHASE_8_3.md §1, docs/PHASE_8_4.md §1).
 */
export function TripForm({
  action,
  trip,
  showEventIdField = false,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: TripFormState, formData: FormData) => Promise<TripFormState>;
  trip?: trips.Trip;
  showEventIdField?: boolean;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {showEventIdField && <Input name="eventId" label="Event ID" hint="Paste the event's ID from its own page" required />}
      <Input name="destination" label="Destination" defaultValue={trip?.destination ?? undefined} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="vehicleRequirement" label="Vehicle requirement" defaultValue={trip?.vehicleRequirement ?? undefined} />
        <Input name="driverName" label="Driver name" defaultValue={trip?.driverName ?? undefined} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="transportVendorId" label="Transport vendor ID" hint="Optional" defaultValue={trip?.transportVendorId ?? undefined} />
        <Input
          name="accommodationVendorId"
          label="Accommodation vendor ID"
          hint="Optional"
          defaultValue={trip?.accommodationVendorId ?? undefined}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="departureAt" label="Departure" type="datetime-local" defaultValue={trip?.departureAt ?? undefined} />
        <Input name="arrivalAt" label="Arrival" type="datetime-local" defaultValue={trip?.arrivalAt ?? undefined} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="returnDepartureAt" label="Return departure" type="datetime-local" defaultValue={trip?.returnDepartureAt ?? undefined} />
        <Input name="returnArrivalAt" label="Return arrival" type="datetime-local" defaultValue={trip?.returnArrivalAt ?? undefined} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input name="estimatedCost" label="Estimated cost" type="number" min={0} step="0.01" defaultValue={trip?.estimatedCost ?? undefined} />
        <Input name="actualCost" label="Actual cost" type="number" min={0} step="0.01" defaultValue={trip?.actualCost ?? undefined} />
        <Input name="currency" label="Currency" defaultValue={trip?.currency ?? "TZS"} />
      </div>
      <Textarea name="notes" label="Notes" defaultValue={trip?.notes ?? undefined} />
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
