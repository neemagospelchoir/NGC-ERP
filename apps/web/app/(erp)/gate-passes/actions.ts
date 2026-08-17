"use server";

import { revalidatePath } from "next/cache";
import { auth, gatePasses } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface GatePassFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createGatePassAction(_prevState: GatePassFormState, formData: FormData): Promise<GatePassFormState> {
  const supabase = await createClient();
  try {
    await gatePasses.createGatePass(supabase, {
      eventId: String(formData.get("eventId") ?? ""),
      personResponsibleId: String(formData.get("personResponsibleId") ?? ""),
      departmentId: readOptionalString(formData, "departmentId"),
      expectedDeparture: readOptionalString(formData, "expectedDeparture"),
      expectedReturn: readOptionalString(formData, "expectedReturn"),
    });
  } catch (err) {
    if (err instanceof gatePasses.ServiceError) return { error: err.message };
    return { error: "Could not create the gate pass." };
  }
  revalidatePath("/gate-passes");
  return {};
}

export async function addGatePassItemAction(gatePassId: string, _prevState: GatePassFormState, formData: FormData): Promise<GatePassFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await gatePasses.addGatePassItem(supabase, gatePassId, {
      assetId: String(formData.get("assetId") ?? ""),
      quantity: Number(formData.get("quantity") ?? 1),
      // Server-derived, never taken from the form — same convention as
      // every other assigned-by/acting-user field in this codebase.
      assignedBy: currentUser?.id ?? null,
      expectedReturnAt: readOptionalString(formData, "expectedReturnAt"),
      override: formData.get("override") === "on",
    });
  } catch (err) {
    if (err instanceof gatePasses.ServiceError) return { error: err.message };
    return { error: "Could not add the item to the gate pass." };
  }
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${gatePassId}`);
  return {};
}

export async function submitGatePassForApprovalAction(gatePassId: string, _prevState: GatePassFormState, formData: FormData): Promise<GatePassFormState> {
  void formData;
  const supabase = await createClient();
  try {
    await gatePasses.submitGatePassForApproval(supabase, gatePassId);
  } catch (err) {
    if (err instanceof gatePasses.ServiceError) return { error: err.message };
    return { error: "Could not submit the gate pass for approval." };
  }
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${gatePassId}`);
  revalidatePath("/approvals");
  return {};
}

export async function decideGatePassApprovalAction(gatePassId: string, _prevState: GatePassFormState, formData: FormData): Promise<GatePassFormState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approve" && decision !== "reject" && decision !== "request_changes") {
    return { error: "Choose a decision." };
  }

  try {
    await gatePasses.decideGatePassApproval(supabase, {
      gatePassId,
      decision,
      comment: readOptionalString(formData, "comment"),
      actingUserId: currentUser.id,
      actingUserRoleCodes: currentUser.roles.map((r) => r.code),
    });
  } catch (err) {
    if (err instanceof gatePasses.ServiceError) return { error: err.message };
    return { error: "Could not record the decision." };
  }
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${gatePassId}`);
  revalidatePath("/approvals");
  return {};
}

export async function checkOutGatePassAction(gatePassId: string): Promise<void> {
  const supabase = await createClient();
  await gatePasses.checkOutGatePass(supabase, gatePassId);
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${gatePassId}`);
}

export async function markGatePassInTransitAction(gatePassId: string): Promise<void> {
  const supabase = await createClient();
  await gatePasses.markGatePassInTransit(supabase, gatePassId);
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${gatePassId}`);
}

export async function returnGatePassItemAction(
  gatePassId: string,
  itemId: string,
  _prevState: GatePassFormState,
  formData: FormData
): Promise<GatePassFormState> {
  const supabase = await createClient();
  const condition = String(formData.get("condition") ?? "good") as gatePasses.ReturnCondition;
  try {
    await gatePasses.returnGatePassItems(supabase, gatePassId, [{ itemId, condition }]);
  } catch (err) {
    if (err instanceof gatePasses.ServiceError) return { error: err.message };
    return { error: "Could not record the item's return." };
  }
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${gatePassId}`);
  return {};
}
