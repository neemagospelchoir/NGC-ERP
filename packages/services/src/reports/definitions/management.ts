import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listWorkflowInstances } from "../../workflow/list-pending";
import type { WorkflowInstanceStatus } from "../../workflow/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Management Report" (PRD §11) — scoped to cross-module approval/
 * workflow activity (ARCHITECTURE.md §12's engine), the same data the
 * Approval Center surfaces but across every status and a real period,
 * not just what's currently pending. `listWorkflowInstances` (new this
 * phase) inherits `workflow_instances_select_scoped` RLS (0019) unchanged
 * — see that function's own doc comment for the one pre-existing RLS
 * characteristic worth naming again here: a caller who only ever matched
 * one step's role/user, not `management.approvals.read_all`, sees an
 * instance only while it still sits at that exact step; this report does
 * not change that. This is explicitly NOT PRD §7.32's "Management/KPI
 * dashboard" — no chart, no computed rate, just a filterable list of
 * workflow instances, per PRD §15's own separation of the two features
 * (see docs/PHASE_13_1.md §1, restated in docs/PHASE_13_2.md §1).
 */
export async function runManagementReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const instances = await listWorkflowInstances(client, {
    createdFrom: from,
    createdTo: to,
    status: filters.status as WorkflowInstanceStatus | undefined,
  });

  return {
    reportKey: "management",
    title: "Management Report",
    period: { from, to },
    columns: [
      { key: "definitionName", label: "Workflow" },
      { key: "recordType", label: "Record type" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Started" },
      { key: "updatedAt", label: "Last updated" },
    ],
    rows: instances.map((i) => ({
      definitionName: i.definitionName,
      recordType: i.recordType,
      status: i.status,
      createdAt: i.createdAt.slice(0, 10),
      updatedAt: i.updatedAt.slice(0, 10),
    })),
  };
}
