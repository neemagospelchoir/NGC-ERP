"use server";

import { revalidatePath } from "next/cache";
import { departments } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface DepartmentFormState {
  error?: string;
}

export async function createDepartmentAction(
  _prevState: DepartmentFormState,
  formData: FormData
): Promise<DepartmentFormState> {
  const supabase = await createClient();
  try {
    await departments.createDepartment(supabase, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof departments.ServiceError) return { error: err.message };
    return { error: "Could not create the department." };
  }
  revalidatePath("/departments");
  return {};
}

export async function updateDepartmentAction(
  id: string,
  _prevState: DepartmentFormState,
  formData: FormData
): Promise<DepartmentFormState> {
  const supabase = await createClient();
  try {
    await departments.updateDepartment(supabase, id, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof departments.ServiceError) return { error: err.message };
    return { error: "Could not update the department." };
  }
  revalidatePath("/departments");
  revalidatePath(`/departments/${id}`);
  return {};
}

export async function toggleDepartmentActiveAction(id: string, nextIsActive: boolean): Promise<void> {
  const supabase = await createClient();
  if (nextIsActive) {
    await departments.reactivateDepartment(supabase, id);
  } else {
    await departments.deactivateDepartment(supabase, id);
  }
  revalidatePath("/departments");
  revalidatePath(`/departments/${id}`);
}
