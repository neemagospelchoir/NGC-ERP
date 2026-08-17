"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, leave } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here runs through the cookie-bound RLS-scoped client.
 * `leave_requests_insert_self` (0006) already restricts creation to the
 * signed-in user's own member record; `leave_requests_update_hr` already
 * requires `attendance.leave.manage` for a decision. No application-layer
 * permission check is duplicated here.
 */

export interface LeaveActionState {
  error?: string;
}

export async function createLeaveRequestAction(_prevState: LeaveActionState, formData: FormData): Promise<LeaveActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser?.member) return { error: "You must have a member record to request leave." };

  let newId: string;
  try {
    const created = await leave.createLeaveRequest(supabase, {
      memberId: currentUser.member.id,
      leaveType: String(formData.get("leaveType") ?? "planned") as leave.LeaveType,
      reason: String(formData.get("reason") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof leave.ServiceError) return { error: err.message };
    return { error: "Could not submit the leave request." };
  }
  revalidatePath("/leave");
  redirect(`/leave/${newId}`);
}

export async function decideLeaveRequestAction(
  id: string,
  decision: "approved" | "rejected",
  _prevState: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await leave.decideLeaveRequest(supabase, id, {
      approverId: currentUser.id,
      decision,
      comment: String(formData.get("comment") ?? "") || null,
    });
  } catch (err) {
    if (err instanceof leave.ServiceError) return { error: err.message };
    return { error: "Could not record the decision." };
  }
  revalidatePath(`/leave/${id}`);
  revalidatePath("/leave");
  return {};
}
