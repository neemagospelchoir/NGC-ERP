"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, discipline } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here runs through the cookie-bound RLS-scoped client.
 * `disciplinary_cases_write_discipline_only`/`disciplinary_actions_write_
 * discipline_only` (0007) already require `discipline.cases.manage` — no
 * application-layer permission check is duplicated here, same "trust
 * Postgres" discipline as every prior module. The one exception is the
 * member-status side effect inside recordAction()/restoreSuspension()
 * (packages/services/src/discipline), which goes through the
 * `apply_disciplinary_membership_status` SECURITY DEFINER function (0026)
 * precisely because RLS gives this role no direct write grant on
 * `members` at all — see that migration's file header.
 */

export interface DisciplineActionState {
  error?: string;
}

export async function createCaseAction(_prevState: DisciplineActionState, formData: FormData): Promise<DisciplineActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  let newId: string;
  try {
    const created = await discipline.createCase(supabase, {
      memberNumber: String(formData.get("memberNumber") ?? ""),
      category: String(formData.get("category") ?? ""),
      incidentDate: String(formData.get("incidentDate") ?? ""),
      description: String(formData.get("description") ?? ""),
      officerId: currentUser.id,
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof discipline.ServiceError) return { error: err.message };
    return { error: "Could not create the disciplinary case." };
  }
  revalidatePath("/discipline");
  redirect(`/discipline/${newId}`);
}

export async function advanceCaseStatusAction(
  caseId: string,
  next: discipline.CaseStatus,
  _prevState: DisciplineActionState,
  _formData: FormData
): Promise<DisciplineActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await discipline.advanceCaseStatus(supabase, caseId, next);
  } catch (err) {
    if (err instanceof discipline.ServiceError) return { error: err.message };
    return { error: "Could not update the case status." };
  }
  revalidatePath(`/discipline/${caseId}`);
  revalidatePath("/discipline");
  return {};
}

export async function recordActionAction(
  caseId: string,
  _prevState: DisciplineActionState,
  formData: FormData
): Promise<DisciplineActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await discipline.recordAction(supabase, {
      caseId,
      actionType: String(formData.get("actionType") ?? "warning") as discipline.ActionType,
      decidedBy: currentUser.id,
      suspensionStartDate: String(formData.get("suspensionStartDate") ?? "") || null,
      suspensionEndDate: String(formData.get("suspensionEndDate") ?? "") || null,
      resolution: String(formData.get("resolution") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof discipline.ServiceError) return { error: err.message };
    return { error: "Could not record the disciplinary action." };
  }
  revalidatePath(`/discipline/${caseId}`);
  revalidatePath("/members");
  return {};
}

export async function restoreSuspensionAction(
  actionId: string,
  caseId: string,
  _prevState: DisciplineActionState,
  formData: FormData
): Promise<DisciplineActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await discipline.restoreSuspension(supabase, {
      actionId,
      restoredBy: currentUser.id,
      restorationReason: String(formData.get("restorationReason") ?? ""),
    });
  } catch (err) {
    if (err instanceof discipline.ServiceError) return { error: err.message };
    return { error: "Could not restore the suspension." };
  }
  revalidatePath(`/discipline/${caseId}`);
  revalidatePath("/members");
  return {};
}
