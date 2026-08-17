"use server";

import { revalidatePath } from "next/cache";
import { auth, applications } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here runs through the cookie-bound RLS-scoped client, NOT
 * the service-role client — unlike apps/web/app/join/actions.ts, these
 * callers are signed-in HR/admin users, and `applications_write_hr`/
 * `members_write_hr`/`member_departments_write_hr`/`member_families_write_hr`/
 * `probation_write_hr` RLS (0004/0005) already gate every write on
 * `members.applications.manage`. No service-role bypass is needed or used.
 */

export interface ApplicationActionState {
  error?: string;
}

export async function advanceApplicationStatusAction(
  applicationId: string,
  nextStatus: "pending_review" | "under_verification" | "pending_approval",
  _prevState: ApplicationActionState,
  _formData: FormData
): Promise<ApplicationActionState> {
  const supabase = await createClient();
  try {
    await applications.advanceApplicationStatus(supabase, applicationId, nextStatus);
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not update the application's status." };
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  return {};
}

export async function markApplicationIncompleteAction(
  applicationId: string,
  _prevState: ApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  const supabase = await createClient();
  const notes = String(formData.get("notes") ?? "")
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
  try {
    await applications.markApplicationIncomplete(supabase, applicationId, notes);
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not mark the application incomplete." };
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  return {};
}

export async function decideApplicationAction(
  applicationId: string,
  decision: "approved" | "rejected",
  _prevState: ApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await applications.decideApplication(supabase, applicationId, {
      reviewerId: currentUser.id,
      decision,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not record the decision." };
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  return {};
}

export async function convertApplicationToMemberAction(
  applicationId: string,
  _prevState: ApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  const primaryDepartmentId = String(formData.get("primaryDepartmentId") ?? "") || null;
  const familyId = String(formData.get("familyId") ?? "") || null;
  const responsibleLeaderId = String(formData.get("responsibleLeaderId") ?? "") || null;

  let memberId: string;
  try {
    const result = await applications.convertApplicationToMember(supabase, applicationId, {
      reviewerId: currentUser.id,
      primaryDepartmentId,
      familyId,
      responsibleLeaderId,
    });
    memberId = result.member.id;
  } catch (err) {
    if (err instanceof applications.ServiceError) return { error: err.message };
    return { error: "Could not convert the application to a member." };
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  revalidatePath("/members");
  revalidatePath("/probation");
  revalidatePath(`/members/${memberId}`);
  return {};
}
