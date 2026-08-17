"use server";

import { revalidatePath } from "next/cache";
import { auth, inventory } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface AssetFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readOptionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createAssetAction(_prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const supabase = await createClient();
  try {
    await inventory.createAsset(supabase, {
      categoryId: String(formData.get("categoryId") ?? ""),
      name: String(formData.get("name") ?? ""),
      serialNumber: readOptionalString(formData, "serialNumber"),
      purchaseDate: readOptionalString(formData, "purchaseDate"),
      purchaseValue: readOptionalNumber(formData, "purchaseValue"),
      currentValue: readOptionalNumber(formData, "currentValue"),
      condition: (readOptionalString(formData, "condition") as inventory.AssetCondition | null) ?? undefined,
      location: readOptionalString(formData, "location"),
    });
  } catch (err) {
    if (err instanceof inventory.ServiceError) return { error: err.message };
    return { error: "Could not create the asset." };
  }
  revalidatePath("/assets");
  return {};
}

export async function updateAssetAction(id: string, _prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const supabase = await createClient();
  try {
    await inventory.updateAsset(supabase, id, {
      categoryId: String(formData.get("categoryId") ?? ""),
      name: String(formData.get("name") ?? ""),
      serialNumber: readOptionalString(formData, "serialNumber"),
      purchaseDate: readOptionalString(formData, "purchaseDate"),
      purchaseValue: readOptionalNumber(formData, "purchaseValue"),
      currentValue: readOptionalNumber(formData, "currentValue"),
      condition: (readOptionalString(formData, "condition") as inventory.AssetCondition | null) ?? undefined,
      location: readOptionalString(formData, "location"),
    });
  } catch (err) {
    if (err instanceof inventory.ServiceError) return { error: err.message };
    return { error: "Could not update the asset." };
  }
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return {};
}

export async function disposeAssetAction(id: string, _prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const supabase = await createClient();
  try {
    await inventory.disposeAsset(supabase, id, String(formData.get("reason") ?? ""));
  } catch (err) {
    if (err instanceof inventory.ServiceError) return { error: err.message };
    return { error: "Could not dispose of the asset." };
  }
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return {};
}

export async function assignAssetAction(assetId: string, _prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await inventory.assignAsset(supabase, {
      assetId,
      targetType: String(formData.get("targetType") ?? "event") as inventory.AssetAssignmentTargetType,
      targetId: String(formData.get("targetId") ?? ""),
      expectedReturnAt: readOptionalString(formData, "expectedReturnAt"),
      // Acting-user id is always resolved server-side, never taken from the
      // form — same convention as recordInvitationApprovalDecisionAction.
      assignedBy: currentUser?.id ?? null,
      override: formData.get("override") === "on",
    });
  } catch (err) {
    if (err instanceof inventory.ServiceError) return { error: err.message };
    return { error: "Could not create the assignment." };
  }
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return {};
}

export async function returnAssignmentAction(
  assetId: string,
  assignmentId: string,
  _prevState: AssetFormState,
  formData: FormData
): Promise<AssetFormState> {
  const supabase = await createClient();
  try {
    await inventory.returnAssignment(supabase, {
      assignmentId,
      returnCondition: String(formData.get("returnCondition") ?? "good") as inventory.ReturnCondition,
      damageReport: readOptionalString(formData, "damageReport"),
    });
  } catch (err) {
    if (err instanceof inventory.ServiceError) return { error: err.message };
    return { error: "Could not record the return." };
  }
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return {};
}
