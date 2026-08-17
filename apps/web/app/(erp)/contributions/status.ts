import type { contributions } from "@ngc/services";

/**
 * Added for Phase 13.2's Contribution Report filter dropdown.
 * `contribution-records-table.tsx` has its own local `STATUS_TONE` map for
 * the on-screen pill and is left untouched — this file exists solely to
 * give the Reports page a `CONTRIBUTION_STATUS_OPTIONS` array, the same
 * shape as CASE_STATUS_OPTIONS/LEAVE_STATUS_OPTIONS in the discipline/leave
 * modules.
 */
const CONTRIBUTION_STATUS_LABEL: Record<contributions.ContributionStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  reversed: "Reversed",
};

export const CONTRIBUTION_STATUS_OPTIONS = Object.entries(CONTRIBUTION_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
