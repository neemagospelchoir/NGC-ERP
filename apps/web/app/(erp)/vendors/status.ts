import type { vendors } from "@ngc/services";

/**
 * Added for Phase 13.2's Vendor Report filter dropdown. `vendors-table.tsx`
 * has its own local `STATUS_TONE` map for the on-screen pill and is left
 * untouched — this file exists solely to give the Reports page a
 * `VENDOR_STATUS_OPTIONS` array, the same shape as CASE_STATUS_OPTIONS/
 * LEAVE_STATUS_OPTIONS in the discipline/leave modules.
 */
const VENDOR_STATUS_LABEL: Record<vendors.VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

export const VENDOR_STATUS_OPTIONS = Object.entries(VENDOR_STATUS_LABEL).map(([value, label]) => ({ value, label }));
