"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, members } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface MemberFormState {
  error?: string;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

/**
 * HR "add a member manually" path (see createMember's doc comment — the
 * primary path once Phase 7.2 exists is Onboarding's application-approval
 * flow, which will call the same service function internally). Redirects
 * into the new member's detail page on success, matching how a human would
 * expect "create" to behave (departments/families instead revalidate the
 * list, since they have no meaningful detail-only content beyond the form
 * already on their own page).
 */
export async function createMemberAction(_prevState: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const supabase = await createClient();
  let newId: string;
  try {
    const created = await members.createMember(supabase, {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      middleName: optionalString(formData, "middleName"),
      preferredName: optionalString(formData, "preferredName"),
      gender: optionalString(formData, "gender"),
      dateOfBirth: optionalString(formData, "dateOfBirth"),
      nationality: optionalString(formData, "nationality"),
      nationalIdNumber: optionalString(formData, "nationalIdNumber"),
      email: optionalString(formData, "email"),
      phone: optionalString(formData, "phone"),
      whatsappNumber: optionalString(formData, "whatsappNumber"),
      physicalAddress: optionalString(formData, "physicalAddress"),
      region: optionalString(formData, "region"),
      district: optionalString(formData, "district"),
      emergencyContactName: optionalString(formData, "emergencyContactName"),
      emergencyContactPhone: optionalString(formData, "emergencyContactPhone"),
      primaryDepartmentId: optionalString(formData, "primaryDepartmentId"),
      familyId: optionalString(formData, "familyId"),
      joinedAt: optionalString(formData, "joinedAt"),
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof members.ServiceError) return { error: err.message };
    return { error: "Could not create the member." };
  }
  revalidatePath("/members");
  redirect(`/members/${newId}`);
}

/** Self-service path — only the allowlisted contact-info fields, enforced at the type level (MemberContactInfoInput) and again by the DB trigger (0023) even if this action were somehow bypassed. */
export async function updateMemberContactInfoAction(
  id: string,
  _prevState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const supabase = await createClient();
  try {
    await members.updateMemberContactInfo(supabase, id, {
      firstName: optionalString(formData, "firstName") ?? undefined,
      lastName: optionalString(formData, "lastName") ?? undefined,
      preferredName: optionalString(formData, "preferredName"),
      gender: optionalString(formData, "gender"),
      nationality: optionalString(formData, "nationality"),
      email: optionalString(formData, "email"),
      phone: optionalString(formData, "phone"),
      whatsappNumber: optionalString(formData, "whatsappNumber"),
      physicalAddress: optionalString(formData, "physicalAddress"),
      region: optionalString(formData, "region"),
      district: optionalString(formData, "district"),
      emergencyContactName: optionalString(formData, "emergencyContactName"),
      emergencyContactPhone: optionalString(formData, "emergencyContactPhone"),
    });
  } catch (err) {
    if (err instanceof members.ServiceError) return { error: err.message };
    return { error: "Could not update your details." };
  }
  revalidatePath(`/members/${id}`);
  return {};
}

/** HR full-record path. Deliberately cannot touch primary_department_id/family_id — see assignDepartmentAction/assignFamilyAction below. */
export async function updateMemberRecordAction(
  id: string,
  _prevState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const supabase = await createClient();
  try {
    await members.updateMemberRecord(supabase, id, {
      firstName: optionalString(formData, "firstName") ?? undefined,
      lastName: optionalString(formData, "lastName") ?? undefined,
      middleName: optionalString(formData, "middleName"),
      preferredName: optionalString(formData, "preferredName"),
      gender: optionalString(formData, "gender"),
      dateOfBirth: optionalString(formData, "dateOfBirth"),
      nationality: optionalString(formData, "nationality"),
      nationalIdNumber: optionalString(formData, "nationalIdNumber"),
      email: optionalString(formData, "email"),
      phone: optionalString(formData, "phone"),
      whatsappNumber: optionalString(formData, "whatsappNumber"),
      physicalAddress: optionalString(formData, "physicalAddress"),
      region: optionalString(formData, "region"),
      district: optionalString(formData, "district"),
      emergencyContactName: optionalString(formData, "emergencyContactName"),
      emergencyContactPhone: optionalString(formData, "emergencyContactPhone"),
      membershipStatus: (optionalString(formData, "membershipStatus") ??
        undefined) as members.MemberRecordInput["membershipStatus"],
      joinedAt: optionalString(formData, "joinedAt"),
      exitedAt: optionalString(formData, "exitedAt"),
      exitReason: optionalString(formData, "exitReason"),
    });
  } catch (err) {
    if (err instanceof members.ServiceError) return { error: err.message };
    return { error: "Could not update the member record." };
  }
  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  return {};
}

export interface AssignmentFormState {
  error?: string;
}

export async function assignDepartmentAction(
  memberId: string,
  _prevState: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const supabase = await createClient();
  const departmentId = String(formData.get("departmentId") ?? "");
  const assignmentType = String(formData.get("assignmentType") ?? "primary") as "primary" | "secondary";
  if (!departmentId) return { error: "Choose a department." };

  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await members.assignDepartment(supabase, {
      memberId,
      departmentId,
      assignmentType,
      changedBy: currentUser.id,
      notes: optionalString(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof members.ServiceError) return { error: err.message };
    return { error: "Could not record the department assignment." };
  }
  revalidatePath(`/members/${memberId}`);
  return {};
}

export async function assignFamilyAction(
  memberId: string,
  _prevState: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const supabase = await createClient();
  const familyId = String(formData.get("familyId") ?? "");
  if (!familyId) return { error: "Choose a family." };

  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await members.assignFamily(supabase, {
      memberId,
      familyId,
      changedBy: currentUser.id,
      notes: optionalString(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof members.ServiceError) return { error: err.message };
    return { error: "Could not record the family assignment." };
  }
  revalidatePath(`/members/${memberId}`);
  return {};
}
