import type { Database } from "@ngc/db";
import type { LeaveRequestSummary, LeaveStatus, LeaveType } from "./types";

type LeaveRequestRow = Database["public"]["Tables"]["leave_requests"]["Row"];

export function mapLeaveRequestSummary(
  row: LeaveRequestRow,
  memberNamesById: Map<string, { name: string; memberNumber: string }>
): LeaveRequestSummary {
  const memberInfo = memberNamesById.get(row.member_id);
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: memberInfo?.name ?? "(unknown member)",
    memberNumber: memberInfo?.memberNumber ?? "—",
    leaveType: row.leave_type as LeaveType,
    reason: row.reason,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as LeaveStatus,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    approverComment: row.approver_comment,
    createdAt: row.created_at,
  };
}
