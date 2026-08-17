import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listAssetCategories, listAssets } from "../../inventory/list";
import type { AssetAvailabilityStatus } from "../../inventory/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Inventory/Asset Report" (PRD §11). Every asset registered in the
 * period — `assets_select_internal` RLS (0010) already lets any signed-in
 * user read the asset registry, same transparency baseline as Vendors.
 * `filters.status`, if set, is interpreted as `AssetAvailabilityStatus`
 * (available/assigned/under_maintenance/missing/disposed) — the asset's
 * *availability*, not a per-assignment status; a report on individual
 * assignment/return activity would need `listAssetAssignments`/
 * `listAssignmentsForTarget` instead, deliberately not built this phase
 * (see docs/PHASE_13_2.md §1).
 */
export async function runAssetsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const [assets, categories] = await Promise.all([
    listAssets(client, {
      availabilityStatus: filters.status as AssetAvailabilityStatus | undefined,
      createdFrom: from,
      createdTo: to,
    }),
    listAssetCategories(client, { includeInactive: true }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    reportKey: "assets",
    title: "Asset Report",
    period: { from, to },
    columns: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "availabilityStatus", label: "Availability" },
      { key: "condition", label: "Condition" },
      { key: "createdAt", label: "Registered" },
    ],
    rows: assets.map((a) => ({
      assetTag: a.assetTag,
      name: a.name,
      category: categoryNameById.get(a.categoryId) ?? "—",
      availabilityStatus: a.availabilityStatus,
      condition: a.condition,
      createdAt: a.createdAt.slice(0, 10),
    })),
  };
}
