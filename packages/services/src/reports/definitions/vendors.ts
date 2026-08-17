import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listVendorCategories, listVendors } from "../../vendors/list";
import type { VendorStatus } from "../../vendors/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Vendor Report" (PRD §11). Every vendor registered in the period —
 * `vendors_select_internal` RLS (0013) already lets any signed-in user
 * read the vendor registry (the same transparency baseline as Uniforms/
 * Technical Riders/Trips), so this report is always-visible, unlike
 * Discipline's. `includeFinancial` is deliberately hard-coded `false`
 * here regardless of the caller's real `finance.vendors.manage`
 * permission — a report export is a file that leaves the on-screen
 * session (downloaded, forwarded, printed), and tax/bank details have no
 * legitimate reason to ride along in an operational "which vendors did
 * we register this quarter" report; a Finance user who genuinely needs
 * a vendor's tax/bank information already has it on that vendor's own
 * detail page. `filters.status` narrows by `VendorStatus`.
 */
export async function runVendorsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const [vendors, categories] = await Promise.all([
    listVendors(client, { status: filters.status as VendorStatus | undefined, createdFrom: from, createdTo: to, includeFinancial: false }),
    listVendorCategories(client),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    reportKey: "vendors",
    title: "Vendor Report",
    period: { from, to },
    columns: [
      { key: "name", label: "Vendor" },
      { key: "category", label: "Category" },
      { key: "contactPerson", label: "Contact" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Registered" },
    ],
    rows: vendors.map((v) => ({
      name: v.name,
      category: categoryNameById.get(v.categoryId) ?? "—",
      contactPerson: v.contactPerson ?? "—",
      status: v.status,
      createdAt: v.createdAt.slice(0, 10),
    })),
  };
}
