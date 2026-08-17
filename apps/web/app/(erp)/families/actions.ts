"use server";

import { revalidatePath } from "next/cache";
import { families } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface FamilyFormState {
  error?: string;
}

export async function createFamilyAction(_prevState: FamilyFormState, formData: FormData): Promise<FamilyFormState> {
  const supabase = await createClient();
  try {
    await families.createFamily(supabase, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof families.ServiceError) return { error: err.message };
    return { error: "Could not create the family." };
  }
  revalidatePath("/families");
  return {};
}

export async function updateFamilyAction(
  id: string,
  _prevState: FamilyFormState,
  formData: FormData
): Promise<FamilyFormState> {
  const supabase = await createClient();
  try {
    await families.updateFamily(supabase, id, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof families.ServiceError) return { error: err.message };
    return { error: "Could not update the family." };
  }
  revalidatePath("/families");
  revalidatePath(`/families/${id}`);
  return {};
}

export async function toggleFamilyActiveAction(id: string, nextIsActive: boolean): Promise<void> {
  const supabase = await createClient();
  if (nextIsActive) {
    await families.reactivateFamily(supabase, id);
  } else {
    await families.deactivateFamily(supabase, id);
  }
  revalidatePath("/families");
  revalidatePath(`/families/${id}`);
}
