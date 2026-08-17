"use server";

import { revalidatePath } from "next/cache";
import { inventory, procurement } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface ProcurementFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createProcurementRequestAction(
  _prevState: ProcurementFormState,
  formData: FormData
): Promise<ProcurementFormState> {
  const supabase = await createClient();
  try {
    await procurement.createProcurementRequest(supabase, {
      expenseRequestId: String(formData.get("expenseRequestId") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
  } catch (err) {
    if (err instanceof procurement.ServiceError) return { error: err.message };
    return { error: "Could not create the procurement request." };
  }
  revalidatePath("/procurement");
  return {};
}

export async function selectVendorAction(id: string, _prevState: ProcurementFormState, formData: FormData): Promise<ProcurementFormState> {
  const supabase = await createClient();
  try {
    await procurement.selectVendor(supabase, id, String(formData.get("vendorId") ?? ""));
  } catch (err) {
    if (err instanceof procurement.ServiceError) return { error: err.message };
    return { error: "Could not select the vendor." };
  }
  revalidatePath("/procurement");
  revalidatePath(`/procurement/${id}`);
  return {};
}

export async function recordPurchaseAction(id: string, _prevState: ProcurementFormState, formData: FormData): Promise<ProcurementFormState> {
  const supabase = await createClient();
  try {
    await procurement.recordPurchase(supabase, id, {
      vendorId: String(formData.get("vendorId") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      purchasedAt: readOptionalString(formData, "purchasedAt") ?? undefined,
    });
  } catch (err) {
    if (err instanceof procurement.ServiceError) return { error: err.message };
    return { error: "Could not record the purchase." };
  }
  revalidatePath("/procurement");
  revalidatePath(`/procurement/${id}`);
  return {};
}

export async function recordPaymentAction(
  purchaseOrderId: string,
  procurementRequestId: string,
  _prevState: ProcurementFormState,
  formData: FormData
): Promise<ProcurementFormState> {
  const supabase = await createClient();
  try {
    await procurement.recordPayment(supabase, purchaseOrderId, {
      paymentStatus: String(formData.get("paymentStatus") ?? "paid") as procurement.PaymentStatus,
    });
  } catch (err) {
    if (err instanceof procurement.ServiceError) return { error: err.message };
    return { error: "Could not record the payment." };
  }
  revalidatePath("/procurement");
  revalidatePath(`/procurement/${procurementRequestId}`);
  return {};
}

export async function createAssetForPurchaseOrderAction(
  purchaseOrderId: string,
  procurementRequestId: string,
  _prevState: ProcurementFormState,
  formData: FormData
): Promise<ProcurementFormState> {
  const supabase = await createClient();
  try {
    await procurement.createAssetForPurchaseOrder(supabase, purchaseOrderId, {
      categoryId: String(formData.get("categoryId") ?? ""),
      name: String(formData.get("name") ?? ""),
      serialNumber: readOptionalString(formData, "serialNumber"),
    });
  } catch (err) {
    if (err instanceof inventory.ServiceError || err instanceof procurement.ServiceError) return { error: err.message };
    return { error: "Could not create the inventory record." };
  }
  revalidatePath("/procurement");
  revalidatePath(`/procurement/${procurementRequestId}`);
  revalidatePath("/assets");
  return {};
}

export async function cancelProcurementRequestAction(id: string): Promise<void> {
  const supabase = await createClient();
  await procurement.cancelProcurementRequest(supabase, id);
  revalidatePath("/procurement");
  revalidatePath(`/procurement/${id}`);
}
