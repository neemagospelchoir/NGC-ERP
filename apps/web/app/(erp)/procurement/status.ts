import type { StatusTone } from "@ngc/ui";
import type { procurement } from "@ngc/services";
import type { SelectOption } from "@ngc/ui";

const PROCUREMENT_STATUS_LABEL: Record<procurement.ProcurementStatus, string> = {
  pending: "Pending vendor",
  vendor_selected: "Vendor selected",
  purchased: "Purchased",
  cancelled: "Cancelled",
};

const PROCUREMENT_STATUS_TONE: Record<procurement.ProcurementStatus, StatusTone> = {
  pending: "neutral",
  vendor_selected: "warning",
  purchased: "good",
  cancelled: "critical",
};

export function procurementStatusLabel(status: procurement.ProcurementStatus): string {
  return PROCUREMENT_STATUS_LABEL[status] ?? status;
}

export function procurementStatusTone(status: procurement.ProcurementStatus): StatusTone {
  return PROCUREMENT_STATUS_TONE[status] ?? "neutral";
}

const PAYMENT_STATUS_LABEL: Record<procurement.PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  partially_paid: "Partially paid",
};

const PAYMENT_STATUS_TONE: Record<procurement.PaymentStatus, StatusTone> = {
  unpaid: "warning",
  paid: "good",
  partially_paid: "warning",
};

export function paymentStatusLabel(status: procurement.PaymentStatus): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export function paymentStatusTone(status: procurement.PaymentStatus): StatusTone {
  return PAYMENT_STATUS_TONE[status] ?? "neutral";
}

export const PAYMENT_STATUS_OPTIONS: SelectOption[] = Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));
