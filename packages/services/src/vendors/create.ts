import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapVendorRow } from "./map";
import type { CreateVendorInput, Vendor } from "./types";

/**
 * Creates a vendor. As with `createDepartment`, no application-layer
 * permission check is duplicated here — `vendors_write_scoped` RLS (0013)
 * enforces `logistics.vendors.manage` OR `finance.vendors.manage` on the
 * INSERT itself. The creator is always trusted with whatever financial
 * fields they submitted (they just typed them in), so the response echoes
 * them back regardless of role — masking only applies to subsequent READS
 * by a *different* caller via `listVendors`/`getVendor`.
 */
export async function createVendor(client: SupabaseClient<Database>, input: CreateVendorInput): Promise<Vendor> {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Vendor name is required.");
  if (!input.categoryId) throw new ServiceError("A vendor category is required.");

  const { data, error } = await client
    .from("vendors")
    .insert({
      name,
      category_id: input.categoryId,
      contact_person: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      tax_information: input.taxInformation ?? null,
      bank_payment_information: input.bankPaymentInformation ?? null,
      performance_notes: input.performanceNotes ?? null,
      status: "active",
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not create the vendor.", error);
  return mapVendorRow(data, true);
}
