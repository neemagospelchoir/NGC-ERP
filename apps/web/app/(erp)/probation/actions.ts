"use server";

import { revalidatePath } from "next/cache";
import { auth, probation } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

/**
 * Same pattern as apps/web/app/(erp)/applications/actions.ts: these callers
 * are signed-in HR/admin users, so every write here runs through the
 * cookie-bound RLS-scoped client and relies on `probation_write_hr` RLS
 * (0005), which already requires `members.applications.manage`.
 */

export interface ProbationActionState {
  error?: string;
}

export async function completeProbationAction(
  probationId: string,
  _prevState: ProbationActionState,
  formData: FormData
): Promise<ProbationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await probation.completeProbation(supabase, probationId, {
      decidedBy: currentUser.id,
      outcomeNotes: String(formData.get("outcomeNotes") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof probation.ServiceError) return { error: err.message };
    return { error: "Could not complete the probation." };
  }
  revalidatePath(`/probation/${probationId}`);
  revalidatePath("/probation");
  revalidatePath("/members");
  return {};
}

export async function failProbationAction(
  probationId: string,
  _prevState: ProbationActionState,
  formData: FormData
): Promise<ProbationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await probation.failProbation(supabase, probationId, {
      decidedBy: currentUser.id,
      outcomeNotes: String(formData.get("outcomeNotes") ?? ""),
    });
  } catch (err) {
    if (err instanceof probation.ServiceError) return { error: err.message };
    return { error: "Could not mark the probation failed." };
  }
  revalidatePath(`/probation/${probationId}`);
  revalidatePath("/probation");
  revalidatePath("/members");
  return {};
}
