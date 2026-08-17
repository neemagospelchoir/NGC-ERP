export type LeaveType = "emergency" | "planned" | "absence_explanation" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_TYPES: LeaveType[] = ["emergency", "planned", "absence_explanation", "other"];

export interface LeaveRequestSummary {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  leaveType: LeaveType;
  reason: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approverComment: string | null;
  createdAt: string;
}

export interface CreateLeaveRequestInput {
  memberId: string;
  leaveType: LeaveType;
  reason: string;
  startDate: string;
  endDate: string;
}

export interface ListLeaveRequestsOptions {
  memberId?: string;
  status?: LeaveStatus;
  /** Inclusive `created_at` range — added for Phase 13.2's HR Report (scoped to leave requests — see docs/PHASE_13_2.md §1), the same shape as every other report definition's period filter. */
  createdFrom?: string;
  createdTo?: string;
}

export interface DecideLeaveRequestInput {
  approverId: string;
  decision: "approved" | "rejected";
  comment?: string | null;
}
