"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, type SelectOption } from "@ngc/ui";
import type { AttendanceActionState } from "./actions";
import { SESSION_TYPE_LABEL } from "./status";

const SESSION_TYPE_OPTIONS: SelectOption[] = Object.entries(SESSION_TYPE_LABEL).map(([value, label]) => ({ value, label }));

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create session"}
    </Button>
  );
}

export function SessionCreateForm({
  action,
  departmentOptions,
}: {
  action: (prevState: AttendanceActionState, formData: FormData) => Promise<AttendanceActionState>;
  departmentOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="title" label="Title" placeholder="Weekly rehearsal" required />
      <Select name="sessionType" label="Session type" options={SESSION_TYPE_OPTIONS} defaultValue="rehearsal" required />
      <Select
        name="departmentId"
        label="Department"
        hint="Leave blank for a whole-choir session"
        placeholder="Whole choir"
        options={departmentOptions}
      />
      <Input name="sessionDate" type="date" label="Session date" required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="startsAt" type="datetime-local" label="Starts at" hint="Optional" />
        <Input name="endsAt" type="datetime-local" label="Ends at" hint="Optional" />
      </div>
      <div>
        <SubmitButton />
      </div>
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}
