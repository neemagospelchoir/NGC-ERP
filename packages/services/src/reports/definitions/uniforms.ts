import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listUniformAssignmentsInPeriod } from "../../uniforms/list";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Uniform Report" (PRD §11). Scoped to *issuance activity* (who was
 * assigned what, and when) rather than the static catalog (`listUniforms`)
 * — the same "records/requests in a period," not "a catalog snapshot,"
 * shape as Contribution/Expense/Discipline, and the more informative of
 * the two readings of "uniform report" (a catalog has no period
 * dimension worth filtering; the seed's own `quantityAvailable` already
 * answers "what's in stock right now" on the live Uniforms page).
 * `listUniformAssignmentsInPeriod` (new this phase) composes the exact
 * same `uniform_assignments_select_scoped` RLS (0012) `listUniformAssignments`/
 * `listAssignmentsForMember` already rely on, so a plain member running
 * this report sees only their own issued items (or their department's, if
 * they lead one) — exactly what those existing screens already show them.
 */
export async function runUniformsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const assignments = await listUniformAssignmentsInPeriod(client, { assignedFrom: from, assignedTo: to });

  return {
    reportKey: "uniforms",
    title: "Uniform Report",
    period: { from, to },
    columns: [
      { key: "memberName", label: "Member" },
      { key: "uniformLabel", label: "Uniform" },
      { key: "quantity", label: "Qty", align: "right" },
      { key: "assignedAt", label: "Issued" },
      { key: "status", label: "Status" },
      { key: "returnedAt", label: "Returned" },
    ],
    rows: assignments.map((a) => ({
      memberName: a.memberName,
      uniformLabel: a.uniformLabel,
      quantity: a.quantity,
      assignedAt: a.assignedAt.slice(0, 10),
      status: a.status,
      returnedAt: a.returnedAt ? a.returnedAt.slice(0, 10) : "—",
    })),
  };
}
