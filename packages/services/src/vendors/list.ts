import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapVendorCategoryRow, mapVendorRow } from "./map";
import type { Vendor, VendorCategory, VendorStatus } from "./types";

export async function listVendorCategories(client: SupabaseClient<Database>): Promise<VendorCategory[]> {
  const { data, error } = await client.from("vendor_categories").select("*").order("name", { ascending: true });
  if (error) throw new ServiceError("Could not load vendor categories.", error);
  return (data ?? []).map(mapVendorCategoryRow);
}

export interface ListVendorsOptions {
  categoryId?: string;
  status?: VendorStatus;
  /**
   * Whether tax/bank fields should be populated on the returned rows.
   * Callers MUST derive this from the signed-in user's real permission
   * codes (`finance.vendors.manage`), resolved server-side — never from a
   * value an end user could set (query param, form field, etc.). Defaults
   * to false (the safer default) so a caller that forgets this option
   * gets masked data rather than an accidental leak.
   */
  includeFinancial?: boolean;
  /** Inclusive `created_at` range — added for Phase 13.2's Vendor Report, the same shape as every other report definition's period filter. */
  createdFrom?: string;
  createdTo?: string;
}

export async function listVendors(client: SupabaseClient<Database>, options: ListVendorsOptions = {}): Promise<Vendor[]> {
  let query = client.from("vendors").select("*").order("name", { ascending: true });
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.status) query = query.eq("status", options.status);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load vendors.", error);
  return (data ?? []).map((row) => mapVendorRow(row, Boolean(options.includeFinancial)));
}

export async function getVendor(
  client: SupabaseClient<Database>,
  id: string,
  options: { includeFinancial?: boolean } = {}
): Promise<Vendor | null> {
  const { data, error } = await client.from("vendors").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the vendor.", error);
  return data ? mapVendorRow(data, Boolean(options.includeFinancial)) : null;
}
