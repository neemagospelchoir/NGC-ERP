export interface VendorCategory {
  id: string;
  name: string;
  createdAt: string;
}

export type VendorStatus = "active" | "inactive" | "blacklisted";

/**
 * `tax_information`/`bank_payment_information` are typed as `string | null`
 * regardless of whether the caller is authorized to see them — the two
 * fields are set to `null` by the mapper when `financialFieldsVisible` is
 * false, exactly as they would be for a vendor that simply never had those
 * values recorded. `financialFieldsVisible` is what a consumer must check
 * before rendering "—" as "not provided" vs. "hidden — Finance only"; never
 * infer visibility from whether the fields happen to be null (see 0013's
 * own column comment directing this split: "RLS grants row access, the
 * service layer projects which columns each role's response includes").
 */
export interface Vendor {
  id: string;
  name: string;
  categoryId: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxInformation: string | null;
  bankPaymentInformation: string | null;
  performanceNotes: string | null;
  status: VendorStatus;
  financialFieldsVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  name: string;
  categoryId: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxInformation?: string | null;
  bankPaymentInformation?: string | null;
  performanceNotes?: string | null;
}

export interface UpdateVendorInput {
  name?: string;
  categoryId?: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxInformation?: string | null;
  bankPaymentInformation?: string | null;
  performanceNotes?: string | null;
}
