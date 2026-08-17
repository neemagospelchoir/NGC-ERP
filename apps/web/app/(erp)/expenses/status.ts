import type { StatusTone } from "@ngc/ui";
import type { expenses } from "@ngc/services";

const EXPENSE_STATUS_LABEL: Record<expenses.ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  closed: "Closed",
};

const EXPENSE_STATUS_TONE: Record<expenses.ExpenseStatus, StatusTone> = {
  draft: "neutral",
  submitted: "warning",
  pending_approval: "warning",
  approved: "good",
  rejected: "critical",
  paid: "good",
  closed: "neutral",
};

export function expenseStatusLabel(status: expenses.ExpenseStatus): string {
  return EXPENSE_STATUS_LABEL[status] ?? status;
}

export function expenseStatusTone(status: expenses.ExpenseStatus): StatusTone {
  return EXPENSE_STATUS_TONE[status] ?? "neutral";
}

/** Added for Phase 13.2's Expense Report filter dropdown — same `Object.entries(...LABEL)` pattern as CASE_STATUS_OPTIONS/LEAVE_STATUS_OPTIONS. */
export const EXPENSE_STATUS_OPTIONS = Object.entries(EXPENSE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const DECISION_LABEL: Record<"approve" | "reject" | "request_changes", string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
};

export const DECISION_OPTIONS = Object.entries(DECISION_LABEL).map(([value, label]) => ({ value, label }));
