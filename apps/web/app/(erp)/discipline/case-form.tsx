"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { DisciplineActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Open case"}
    </Button>
  );
}

/**
 * Takes a member NUMBER, not a picker — the signed-in Discipline Manager
 * has no general read access to browse/search members (see
 * packages/services/src/discipline/find-member.ts's doc comment); they
 * already know the member's ID number from the incident itself.
 */
export function CaseCreateForm({
  action,
  categoryOptions,
}: {
  action: (prevState: DisciplineActionState, formData: FormData) => Promise<DisciplineActionState>;
  categoryOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="memberNumber" label="Member number" placeholder="NGC-2026-0001" hint="Exact Member ID — this module has no member directory" required />
      <Select name="category" label="Category" options={categoryOptions} placeholder="Select…" required />
      <Input name="incidentDate" type="date" label="Incident date" required />
      <Textarea name="description" label="Description" hint="What happened, per the incident report" required />
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
