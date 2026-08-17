import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listMembers } from "../../members/list";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Member Report" (PRD §11's "member" report; §15 MVP names it as core
 * reporting). The period filter here means "joined within this window" —
 * a roster of new members for a month/quarter/year — not "every member
 * who existed during this window" (a snapshot report of the whole current
 * roster needs no period at all; a member who joined years ago is still
 * a member today regardless of what period is selected). `departmentId`/
 * `status` narrow it further, exactly as `listMembers` already supports —
 * this function adds no query logic of its own beyond resolving the
 * period and calling that existing, unchanged, RLS-scoped function
 * (`members_select_scoped`, 0004), per ARCHITECTURE.md §15's "report
 * queries run against the same RLS-protected... the live UI uses."
 */
export async function runMembersReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const members = await listMembers(client, {
    joinedFrom: from,
    joinedTo: to,
    departmentId: filters.departmentId,
    membershipStatus: filters.status,
  });

  return {
    reportKey: "members",
    title: "Member Report",
    period: { from, to },
    columns: [
      { key: "memberNumber", label: "Member #" },
      { key: "name", label: "Name" },
      { key: "department", label: "Department" },
      { key: "family", label: "Family" },
      { key: "status", label: "Status" },
      { key: "joinedAt", label: "Joined" },
    ],
    rows: members.map((m) => ({
      memberNumber: m.memberNumber,
      name: `${m.preferredName ?? m.firstName} ${m.lastName}`,
      department: m.primaryDepartmentName ?? "—",
      family: m.familyName ?? "—",
      status: m.membershipStatus,
      joinedAt: m.joinedAt ?? "—",
    })),
  };
}
