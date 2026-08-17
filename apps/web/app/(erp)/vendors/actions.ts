"use server";

import { revalidatePath } from "next/cache";
import { vendors } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface VendorFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createVendorAction(_prevState: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const supabase = await createClient();
  try {
    await vendors.createVendor(supabase, {
      name: String(formData.get("name") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      contactPerson: readOptionalString(formData, "contactPerson"),
      phone: readOptionalString(formData, "phone"),
      email: readOptionalString(formData, "email"),
      address: readOptionalString(formData, "address"),
      taxInformation: readOptionalString(formData, "taxInformation"),
      bankPaymentInformation: readOptionalString(formData, "bankPaymentInformation"),
      performanceNotes: readOptionalString(formData, "performanceNotes"),
    });
  } catch (err) {
    if (err instanceof vendors.ServiceError) return { error: err.message };
    return { error: "Could not create the vendor." };
  }
  revalidatePath("/vendors");
  return {};
}

export async function updateVendorAction(id: string, _prevState: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const supabase = await createClient();
  try {
    await vendors.updateVendor(supabase, id, {
      name: String(formData.get("name") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      contactPerson: readOptionalString(formData, "contactPerson"),
      phone: readOptionalString(formData, "phone"),
      email: readOptionalString(formData, "email"),
      address: readOptionalString(formData, "address"),
      // Only included when the form actually rendered these fields
      // (`VendorForm`'s `canSeeFinancial` gate) — omitting the key leaves
      // `updateVendor`'s patch untouched for it, rather than a Logistics
      // Officer's edit (who never sees these fields) silently wiping out
      // Finance-recorded tax/bank information.
      ...(formData.has("taxInformation") ? { taxInformation: readOptionalString(formData, "taxInformation") } : {}),
      ...(formData.has("bankPaymentInformation")
        ? { bankPaymentInformation: readOptionalString(formData, "bankPaymentInformation") }
        : {}),
      performanceNotes: readOptionalString(formData, "performanceNotes"),
    });
  } catch (err) {
    if (err instanceof vendors.ServiceError) return { error: err.message };
    return { error: "Could not update the vendor." };
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return {};
}

export async function setVendorStatusAction(id: string, status: vendors.VendorStatus): Promise<void> {
  const supabase = await createClient();
  await vendors.setVendorStatus(supabase, id, status);
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
}
