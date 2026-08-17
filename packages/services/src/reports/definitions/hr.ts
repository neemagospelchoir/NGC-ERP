import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listLeaveRequests } from "../../leave/list";
import type { LeaveStatus } from "../../leave/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "HR Report" (PRD §11) — scoped to Leave Requests, the same "pick the
 * one existing, unambiguously-HR data set with a period dimension"
 * reasoning the Invitation Report used in 13.1 for its own "volume"
 * scoping (docs/PHASE_13_1.md §1). Applications/Probation are onboarding-
 * lifecycle data already substantially covered by the Member Report's
 * own period-filtered "who joined this window" view; Leave is the
 * cleanest standalone HR activity record left. `leave_requests_select_
 * scoped` RLS (0006) already narrows this to the caller's own requests,
 * `attendance.leave.manage` holders, or a Department Leader's own
 * department scope — this report inherits that unchanged, exactly the
 * same shape as the Leave page itself.
 */
export async function runHrReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const requests = await listLeaveRequests(client, {
    createdFrom: from,
    createdTo: to,
    status: filters.status as LeaveStatus | undefined,
  });

  return {
    reportKey: "hr",
    title: "HR Report",
    period: { from, to },
    columns: [
      { key: "memberName", label: "Member" },
      { key: "leaveType", label: "Type" },
      { key: "startDate", label: "Start" },
      { key: "endDate", label: "End" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Requested" },
    ],
    rows: requests.map((r) => ({
      memberName: r.memberName,
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      createdAt: r.createdAt.slice(0, 10),
    })),
  };
}
