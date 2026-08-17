import type { Database } from "@ngc/db";
import type { ExpenseRequest, ExpenseStatus } from "./types";

type ExpenseRequestRow = Database["public"]["Tables"]["expense_requests"]["Row"];

export function mapExpenseRequestRow(row: ExpenseRequestRow): ExpenseRequest {
  return {
    id: row.id,
    requestNumber: row.request_number,
    requestedBy: row.requested_by,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    category: row.category,
    departmentId: row.department_id,
    eventId: row.event_id,
    supportingDocumentId: row.supporting_document_id,
    status: row.status as ExpenseStatus,
    paidAt: row.paid_at,
    paymentReference: row.payment_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
