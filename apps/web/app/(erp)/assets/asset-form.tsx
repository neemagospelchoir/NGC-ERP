"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, type SelectOption } from "@ngc/ui";
import type { AssetFormState } from "./actions";

const CONDITION_OPTIONS: SelectOption[] = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "damaged", label: "Damaged" },
];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AssetForm({
  action,
  categoryOptions,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState>;
  categoryOptions: SelectOption[];
  initial?: {
    name?: string;
    categoryId?: string;
    serialNumber?: string | null;
    purchaseDate?: string | null;
    purchaseValue?: number | null;
    currentValue?: number | null;
    condition?: string;
    location?: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="name" label="Asset name" defaultValue={initial?.name} required />
      <Select name="categoryId" label="Category" options={categoryOptions} defaultValue={initial?.categoryId} placeholder="Select a category" required />
      <Input name="serialNumber" label="Serial number" hint="Optional" defaultValue={initial?.serialNumber ?? ""} />
      <Select name="condition" label="Condition" options={CONDITION_OPTIONS} defaultValue={initial?.condition ?? "good"} />
      <Input name="location" label="Location" hint="Optional — storage room, department, etc." defaultValue={initial?.location ?? ""} />
      <Input name="purchaseDate" label="Purchase date" type="date" hint="Optional" defaultValue={initial?.purchaseDate ?? ""} />
      <Input name="purchaseValue" label="Purchase value (TZS)" type="number" step="0.01" hint="Optional" defaultValue={initial?.purchaseValue ?? ""} />
      <Input name="currentValue" label="Current value (TZS)" type="number" step="0.01" hint="Optional" defaultValue={initial?.currentValue ?? ""} />
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
