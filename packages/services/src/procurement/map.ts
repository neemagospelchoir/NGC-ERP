import type { Database } from "@ngc/db";
import type { PaymentStatus, ProcurementRequest, ProcurementStatus, PurchaseOrder } from "./types";

type ProcurementRequestRow = Database["public"]["Tables"]["procurement_requests"]["Row"];
type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"];

export function mapProcurementRequestRow(row: ProcurementRequestRow): ProcurementRequest {
  return {
    id: row.id,
    expenseRequestId: row.expense_request_id,
    vendorId: row.vendor_id,
    description: row.description,
    status: row.status as ProcurementStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPurchaseOrderRow(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    procurementRequestId: row.procurement_request_id,
    vendorId: row.vendor_id,
    amount: Number(row.amount),
    currency: row.currency,
    purchasedAt: row.purchased_at,
    paidAt: row.paid_at,
    paymentStatus: row.payment_status as PaymentStatus,
    createdAssetId: row.created_asset_id,
    createdAt: row.created_at,
  };
}
