"use server";

import { revalidatePath } from "next/cache";
import { auth, uniforms } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface UniformFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createUniformAction(_prevState: UniformFormState, formData: FormData): Promise<UniformFormState> {
  const supabase = await createClient();
  try {
    await uniforms.createUniform(supabase, {
      uniformType: String(formData.get("uniformType") ?? ""),
      size: readOptionalString(formData, "size"),
      quantityTotal: Number(formData.get("quantityTotal") ?? 0),
      storageLocation: readOptionalString(formData, "storageLocation"),
    });
  } catch (err) {
    if (err instanceof uniforms.ServiceError) return { error: err.message };
    return { error: "Could not create the uniform registry entry." };
  }
  revalidatePath("/uniforms");
  return {};
}

export async function updateUniformAction(id: string, _prevState: UniformFormState, formData: FormData): Promise<UniformFormState> {
  const supabase = await createClient();
  try {
    await uniforms.updateUniform(supabase, id, {
      uniformType: String(formData.get("uniformType") ?? ""),
      size: readOptionalString(formData, "size"),
      quantityTotal: Number(formData.get("quantityTotal") ?? 0),
      quantityAvailable: Number(formData.get("quantityAvailable") ?? 0),
      storageLocation: readOptionalString(formData, "storageLocation"),
    });
  } catch (err) {
    if (err instanceof uniforms.ServiceError) return { error: err.message };
    return { error: "Could not update the uniform." };
  }
  revalidatePath("/uniforms");
  revalidatePath(`/uniforms/${id}`);
  return {};
}

export async function setUniformConditionAction(id: string, condition: uniforms.UniformCondition): Promise<void> {
  const supabase = await createClient();
  await uniforms.setUniformCondition(supabase, id, condition);
  revalidatePath("/uniforms");
  revalidatePath(`/uniforms/${id}`);
}

export async function assignUniformAction(uniformId: string, _prevState: UniformFormState, formData: FormData): Promise<UniformFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await uniforms.assignUniform(supabase, {
      uniformId,
      memberId: String(formData.get("memberId") ?? ""),
      eventId: readOptionalString(formData, "eventId"),
      quantity: Number(formData.get("quantity") ?? 1),
      // Acting-user id is always resolved server-side, never taken from the
      // form — same convention as recordInvitationApprovalDecisionAction /
      // assignAssetAction.
      assignedBy: currentUser?.id ?? null,
    });
  } catch (err) {
    if (err instanceof uniforms.ServiceError) return { error: err.message };
    return { error: "Could not create the assignment." };
  }
  revalidatePath("/uniforms");
  revalidatePath(`/uniforms/${uniformId}`);
  return {};
}

export async function returnUniformAssignmentAction(
  uniformId: string,
  assignmentId: string,
  _prevState: UniformFormState,
  formData: FormData
): Promise<UniformFormState> {
  const supabase = await createClient();
  try {
    await uniforms.returnUniformAssignment(supabase, {
      assignmentId,
      returnCondition: String(formData.get("returnCondition") ?? "good") as uniforms.ReturnCondition,
    });
  } catch (err) {
    if (err instanceof uniforms.ServiceError) return { error: err.message };
    return { error: "Could not record the return." };
  }
  revalidatePath("/uniforms");
  revalidatePath(`/uniforms/${uniformId}`);
  return {};
}
