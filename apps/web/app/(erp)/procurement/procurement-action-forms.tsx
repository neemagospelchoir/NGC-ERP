"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, type SelectOption } from "@ngc/ui";
import type { ProcurementFormState } from "./actions";
import { PAYMENT_STATUS_OPTIONS } from "./status";

type BoundAction = (prevState: ProcurementFormState, formData: FormData) => Promise<ProcurementFormState>;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Vendor is a real `<Select>` populated via `vendors.listVendors()`, the
 * same deliberate departure from the paste-the-id convention used by
 * `ProcurementForm`'s expense-request field — see docs/PHASE_9_3.md §2.2.
 */
export function VendorSelectForm({ action, vendorOptions }: { action: BoundAction; vendorOptions: SelectOption[] }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select
        name="vendorId"
        label="Vendor"
        options={vendorOptions}
        placeholder="Select a vendor"
        hint={vendorOptions.length === 0 ? "No vendors are available yet." : undefined}
        required
      />
      <div>
        <SubmitButton label="Select vendor" pendingLabel="Saving…" />
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

/** Vendor defaults to the procurement request's own already-selected vendor, since a purchase is normally made from that vendor. */
export function RecordPurchaseForm({
  action,
  vendorOptions,
  defaultVendorId,
}: {
  action: BoundAction;
  vendorOptions: SelectOption[];
  defaultVendorId?: string | null;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select name="vendorId" label="Vendor" options={vendorOptions} defaultValue={defaultVendorId ?? ""} placeholder="Select a vendor" required />
      <Input name="amount" label="Amount" type="number" min={0} step="0.01" required />
      <Input name="currency" label="Currency" defaultValue="TZS" hint="Optional — defaults to TZS" />
      <Input name="purchasedAt" label="Purchase date" type="date" hint="Optional — defaults to now" />
      <div>
        <SubmitButton label="Record purchase" pendingLabel="Recording…" />
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

export function RecordPaymentForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select name="paymentStatus" label="Payment status" options={PAYMENT_STATUS_OPTIONS} defaultValue="paid" required />
      <div>
        <SubmitButton label="Record payment" pendingLabel="Recording…" />
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

export function CreateAssetForm({ action, categoryOptions }: { action: BoundAction; categoryOptions: SelectOption[] }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Select
        name="categoryId"
        label="Asset category"
        options={categoryOptions}
        placeholder="Select a category"
        hint={categoryOptions.length === 0 ? "No active asset categories are available yet." : undefined}
        required
      />
      <Input name="name" label="Asset name" required />
      <Input name="serialNumber" label="Serial number" hint="Optional" />
      <div>
        <SubmitButton label="Create inventory record" pendingLabel="Creating…" />
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
