"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, type SelectOption } from "@ngc/ui";
import type { UniformFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function UniformForm({
  action,
  categoryOptions,
  showQuantityAvailable,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: UniformFormState, formData: FormData) => Promise<UniformFormState>;
  categoryOptions: SelectOption[];
  /** Only the edit form exposes a direct `quantityAvailable` correction (see actions.ts/update.ts's doc comments on manual restocking) — a new entry always starts fully available. */
  showQuantityAvailable?: boolean;
  initial?: {
    uniformType?: string;
    size?: string | null;
    quantityTotal?: number;
    quantityAvailable?: number;
    storageLocation?: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="uniformType" label="Uniform type" options={categoryOptions} defaultValue={initial?.uniformType} placeholder="Select a type" required />
      <Input name="size" label="Size" hint="Optional" defaultValue={initial?.size ?? ""} />
      <Input name="quantityTotal" label="Total quantity" type="number" min={0} defaultValue={initial?.quantityTotal ?? 0} required />
      {showQuantityAvailable && (
        <Input
          name="quantityAvailable"
          label="Available quantity"
          type="number"
          min={0}
          hint="Manual correction only — e.g. crediting a repaired item back into circulation"
          defaultValue={initial?.quantityAvailable ?? 0}
          required
        />
      )}
      <Input name="storageLocation" label="Storage location" hint="Optional" defaultValue={initial?.storageLocation ?? ""} />
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
