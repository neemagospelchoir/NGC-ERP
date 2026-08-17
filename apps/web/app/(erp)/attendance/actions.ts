"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, attendance } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here runs through the cookie-bound RLS-scoped client —
 * `attendance_sessions_write_scoped`/`attendance_write_scoped` RLS (0006)
 * already require `attendance.records.manage` OR that the session's
 * department is in the caller's own scoped departments (a Department
 * Leader marking attendance for their own department), so no
 * application-layer permission check is duplicated here.
 */

export interface AttendanceActionState {
  error?: string;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createSessionAction(_prevState: AttendanceActionState, formData: FormData): Promise<AttendanceActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  let newId: string;
  try {
    const created = await attendance.createSession(supabase, {
      sessionType: String(formData.get("sessionType") ?? "rehearsal") as attendance.SessionType,
      title: String(formData.get("title") ?? ""),
      departmentId: optionalString(formData, "departmentId"),
      sessionDate: String(formData.get("sessionDate") ?? ""),
      startsAt: optionalString(formData, "startsAt"),
      endsAt: optionalString(formData, "endsAt"),
      createdBy: currentUser.id,
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof attendance.ServiceError) return { error: err.message };
    return { error: "Could not create the attendance session." };
  }
  revalidatePath("/attendance");
  redirect(`/attendance/${newId}`);
}

export async function recordAttendanceAction(
  sessionId: string,
  memberId: string,
  _prevState: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  try {
    await attendance.recordAttendance(supabase, {
      sessionId,
      memberId,
      statusCode: String(formData.get("statusCode") ?? ""),
      notes: optionalString(formData, "notes"),
      recordedBy: currentUser.id,
    });
  } catch (err) {
    if (err instanceof attendance.ServiceError) return { error: err.message };
    return { error: "Could not record attendance." };
  }
  revalidatePath(`/attendance/${sessionId}`);
  return {};
}
