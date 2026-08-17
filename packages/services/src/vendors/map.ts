import type { Database } from "@ngc/db";
import type { Vendor, VendorCategory, VendorStatus } from "./types";

type VendorCategoryRow = Database["public"]["Tables"]["vendor_categories"]["Row"];
type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];

export function mapVendorCategoryRow(row: VendorCategoryRow): VendorCategory {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

/**
 * `includeFinancial` must come from a server-resolved permission check
 * (`finance.vendors.manage`), never from client input — see vendors/list.ts
 * and the callers in apps/web for where that check actually happens.
 */
export function mapVendorRow(row: VendorRow, includeFinancial: boolean): Vendor {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    taxInformation: includeFinancial ? row.tax_information : null,
    bankPaymentInformation: includeFinancial ? row.bank_payment_information : null,
    performanceNotes: row.performance_notes,
    status: row.status as VendorStatus,
    financialFieldsVisible: includeFinancial,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
