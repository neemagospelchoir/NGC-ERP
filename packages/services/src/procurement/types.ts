export type ProcurementStatus = "pending" | "vendor_selected" | "purchased" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "partially_paid";

export interface ProcurementRequest {
  id: string;
  expenseRequestId: string;
  vendorId: string | null;
  description: string;
  status: ProcurementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  procurementRequestId: string;
  vendorId: string;
  amount: number;
  currency: string;
  purchasedAt: string | null;
  paidAt: string | null;
  paymentStatus: PaymentStatus;
  /**
   * Populated once `createAssetForPurchaseOrder` (asset.ts) has run —
   * PRD §7.17's "automatically create or suggest an inventory record" for
   * a purchase that turns out to be an asset (vs. a consumable/one-off
   * expense, which never gets one). Reuses Phase 8.1's `inventory.
   * createAsset` directly rather than re-implementing asset creation here,
   * the same reuse-not-reimplement pattern Gate Pass (8.3) established for
   * `inventory.assignAsset`.
   */
  createdAssetId: string | null;
  createdAt: string;
}

export interface CreateProcurementRequestInput {
  expenseRequestId: string;
  vendorId?: string | null;
  description: string;
}

export interface RecordPurchaseInput {
  vendorId: string;
  amount: number;
  currency?: string;
  purchasedAt?: string;
}

export interface RecordPaymentInput {
  paymentStatus: PaymentStatus;
  paidAt?: string;
}
