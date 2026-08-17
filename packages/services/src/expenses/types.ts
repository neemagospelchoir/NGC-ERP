/**
 * `expense_requests.status` (0014) has a seven-value check constraint:
 * 'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid',
 * 'closed'. This phase deliberately never persists `'submitted'` as its own
 * distinct database state — see `workflow.ts`'s doc comment on
 * `submitExpenseRequestForApproval` for why "Draft -> Submitted -> Pending
 * Approval" (PRD §7.16's own wording) is treated as ONE atomic transition
 * (`draft -> pending_approval`) rather than two. `'submitted'` stays in this
 * type (and the DB constraint) for forward compatibility only; nothing in
 * this phase's service layer ever sets it.
 */
export type ExpenseStatus = "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "paid" | "closed";

export interface ExpenseRequest {
  id: string;
  requestNumber: string;
  requestedBy: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  departmentId: string | null;
  eventId: string | null;
  /**
   * Paste-the-id cross-reference to `documents` (0015) — the FIRST module
   * in this codebase to actually wire this kind of field up end-to-end.
   * Leave's equivalent `leave_requests.supporting_document_id` (Phase 7.3)
   * was silently never given a service-layer field at all; this phase does
   * not repeat that silent omission (a plain paste-the-id text field, the
   * same established simplification as every other cross-module reference
   * in this codebase — see docs/PHASE_9_2.md §2 for the full reasoning).
   */
  supportingDocumentId: string | null;
  status: ExpenseStatus;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequestInput {
  description: string;
  amount: number;
  currency?: string;
  category?: string | null;
  departmentId?: string | null;
  eventId?: string | null;
  supportingDocumentId?: string | null;
  /** Always resolved server-side from the authenticated session, never taken from client input — see actions.ts's own doc comment. */
  requestedBy: string;
}

export interface UpdateExpenseRequestInput {
  description?: string;
  amount?: number;
  currency?: string;
  category?: string | null;
  departmentId?: string | null;
  eventId?: string | null;
  supportingDocumentId?: string | null;
}

export interface ExpenseCategoryOption {
  code: string;
  label: string;
}
