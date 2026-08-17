"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input } from "@ngc/ui";
import type { ContributionsFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `memberId` is a plain paste-the-id text field, not a name-search picker —
 * the same deliberate, documented simplification as Uniforms'
 * `AssignUniformForm`/Assets' `targetId` (docs/PHASE_8_1.md §1).
 */
export function RecordContributionForm({
  action,
}: {
  action: (prevState: ContributionsFormState, formData: FormData) => Promise<ContributionsFormState>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="memberId" label="Member ID" hint="Paste the member's ID from their own page" required />
      <Input name="amount" label="Amount" type="number" min={0} step="0.01" required />
      <Input name="contributedAt" label="Date" type="date" hint="Defaults to today if left blank" />
      <Input name="paymentMethod" label="Payment method" hint="Optional — e.g. cash, mobile_money, bank_transfer" />
      <Input name="reference" label="Reference" hint="Optional — receipt/transaction number" />
      <Input name="notes" label="Notes" hint="Optional" />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label="Record contribution" pendingLabel="Recording…" />
      </div>
    </form>
  );
}
