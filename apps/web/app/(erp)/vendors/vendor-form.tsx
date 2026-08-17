"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { VendorFormState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * `canSeeFinancial` gates whether the tax/bank fields render at all — not
 * just whether they're pre-filled. This mirrors the read-side masking in
 * `vendors.listVendors`/`getVendor` (see 0013's column comment: "Logistics
 * sees vendor contact but not banking details"): a Logistics Officer who
 * can create/edit a vendor (RLS grants that via `logistics.vendors.manage`)
 * still never sees or overwrites Finance-only fields through this form.
 */
export function VendorForm({
  action,
  categoryOptions,
  canSeeFinancial,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: VendorFormState, formData: FormData) => Promise<VendorFormState>;
  categoryOptions: SelectOption[];
  canSeeFinancial: boolean;
  initial?: {
    name?: string;
    categoryId?: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxInformation?: string | null;
    bankPaymentInformation?: string | null;
    performanceNotes?: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="name" label="Vendor name" defaultValue={initial?.name} required />
      <Select name="categoryId" label="Category" options={categoryOptions} defaultValue={initial?.categoryId} placeholder="Select a category" required />
      <Input name="contactPerson" label="Contact person" hint="Optional" defaultValue={initial?.contactPerson ?? ""} />
      <Input name="phone" label="Phone" hint="Optional" defaultValue={initial?.phone ?? ""} />
      <Input name="email" label="Email" type="email" hint="Optional" defaultValue={initial?.email ?? ""} />
      <Textarea name="address" label="Address" hint="Optional" defaultValue={initial?.address ?? ""} />
      {canSeeFinancial ? (
        <>
          <Input
            name="taxInformation"
            label="Tax information"
            hint="Finance only — never shown to other roles"
            defaultValue={initial?.taxInformation ?? ""}
          />
          <Input
            name="bankPaymentInformation"
            label="Bank/payment information"
            hint="Finance only — never shown to other roles"
            defaultValue={initial?.bankPaymentInformation ?? ""}
          />
        </>
      ) : (
        <p className="text-xs text-ink-muted">Tax and bank/payment information are managed by Finance and aren&apos;t shown here.</p>
      )}
      <Textarea name="performanceNotes" label="Performance notes" hint="Optional" defaultValue={initial?.performanceNotes ?? ""} />
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
