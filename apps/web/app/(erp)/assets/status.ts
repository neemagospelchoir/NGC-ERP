import type { inventory } from "@ngc/services";

/**
 * Added for Phase 13.2's Asset Report filter dropdown. `page.tsx` has its
 * own local, unexported `AVAILABILITY_OPTIONS` array for its own filter —
 * left untouched — this file exists solely to give the Reports page a
 * reusable `ASSET_AVAILABILITY_STATUS_OPTIONS` array, the same shape as
 * CASE_STATUS_OPTIONS/LEAVE_STATUS_OPTIONS in the discipline/leave modules.
 */
const ASSET_AVAILABILITY_STATUS_LABEL: Record<inventory.AssetAvailabilityStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  under_maintenance: "Under maintenance",
  missing: "Missing",
  disposed: "Disposed",
};

export const ASSET_AVAILABILITY_STATUS_OPTIONS = Object.entries(ASSET_AVAILABILITY_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
