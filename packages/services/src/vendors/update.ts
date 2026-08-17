import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapVendorRow } from "./map";
import type { UpdateVendorInput, Vendor, VendorStatus } from "./types";

/**
 * Updates a vendor. The response echoes back financial fields ONLY when
 * this specific call actually patched one of them — the caller who just
 * typed a new tax/bank value obviously already knows it. A caller who
 * patches unrelated fields (name, phone, ...) gets those financial fields
 * masked in the response, same as a plain read would, even though the
 * underlying UPDATE (via RLS) may have succeeded regardless of role —
 * this closes a latent leak a future caller that actually uses the return
 * value could otherwise hit (a security review flagged the prior version,
 * which unconditionally echoed real values, as exactly this risk).
 */
export async function updateVendor(client: SupabaseClient<Database>, id: string, input: UpdateVendorInput): Promise<Vendor> {
  const patch: Database["public"]["Tables"]["vendors"]["Update"] = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ServiceError("Vendor name cannot be empty.");
    patch.name = trimmed;
  }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.contactPerson !== undefined) patch.contact_person = input.contactPerson;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.address !== undefined) patch.address = input.address;
  if (input.taxInformation !== undefined) patch.tax_information = input.taxInformation;
  if (input.bankPaymentInformation !== undefined) patch.bank_payment_information = input.bankPaymentInformation;
  if (input.performanceNotes !== undefined) patch.performance_notes = input.performanceNotes;

  const touchedFinancial = input.taxInformation !== undefined || input.bankPaymentInformation !== undefined;

  const { data, error } = await client.from("vendors").update(patch).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the vendor.", error);
  return mapVendorRow(data, touchedFinancial);
}

/** Never touches financial fields, so the response never includes them. */
export async function setVendorStatus(client: SupabaseClient<Database>, id: string, status: VendorStatus): Promise<Vendor> {
  const { data, error } = await client.from("vendors").update({ status }).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the vendor's status.", error);
  return mapVendorRow(data, false);
}
