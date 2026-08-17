"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Checkbox, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { AssetFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const TARGET_TYPE_OPTIONS: SelectOption[] = [
  { value: "event", label: "Event" },
  { value: "member", label: "Member" },
  { value: "department", label: "Department" },
];

/**
 * `targetId` is a plain text field, not a name-search picker — this phase
 * deliberately keeps assignment target selection minimal (paste the ID
 * from the Members/Departments/Events page you're assigning to) rather
 * than building a full cross-module search-and-select control. Flagged as
 * a deferred UX improvement in docs/PHASE_8_1.md, not silently assumed
 * unnecessary.
 */
export function AssignAssetForm({ action }: { action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="targetType" label="Assign to" options={TARGET_TYPE_OPTIONS} defaultValue="event" required />
      <Input name="targetId" label="Target ID" hint="Paste the member/department/event's ID from its own page" required />
      <Input name="expectedReturnAt" label="Expected return" type="datetime-local" hint="Optional" />
      <Checkbox name="override" label="Override — assign even though this asset isn't currently available" />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Assign" pendingLabel="Assigning…" />
      </div>
    </form>
  );
}

const RETURN_CONDITION_OPTIONS: SelectOption[] = [
  { value: "good", label: "Good — fully returned" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
];

export function ReturnAssignmentForm({ action }: { action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="returnCondition" label="Return condition" options={RETURN_CONDITION_OPTIONS} defaultValue="good" required />
      <Textarea name="damageReport" label="Damage report" hint="Required if returning as damaged" />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Record return" pendingLabel="Recording…" />
      </div>
    </form>
  );
}

export function DisposeAssetForm({ action }: { action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Textarea name="reason" label="Disposal reason" required />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="destructive">
          Dispose asset
        </Button>
      </div>
    </form>
  );
}
