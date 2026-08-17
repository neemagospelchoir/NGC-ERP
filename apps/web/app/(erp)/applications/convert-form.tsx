"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Select, type SelectOption } from "@ngc/ui";
import type { ApplicationActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Converting…" : "Create member & start probation"}
    </Button>
  );
}

export function ConvertForm({
  action,
  departmentOptions,
  familyOptions,
}: {
  action: (prevState: ApplicationActionState, formData: FormData) => Promise<ApplicationActionState>;
  departmentOptions: SelectOption[];
  familyOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select
        name="primaryDepartmentId"
        label="Primary department"
        hint="Optional — can be set later"
        placeholder="Select…"
        options={departmentOptions}
      />
      <Select name="familyId" label="Family" hint="Optional — can be set later" placeholder="Select…" options={familyOptions} />
      <SubmitButton />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
    </form>
  );
}
