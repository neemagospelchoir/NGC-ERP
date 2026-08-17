"use server";

import { redirect } from "next/navigation";
import { auth } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface ResetPasswordFormState {
  error?: string;
}

/**
 * Sets a new password for the session established by /auth/callback's code
 * exchange. If there is no active session at all (link expired/reused, or
 * someone hit this action directly), fails closed with a clear message
 * instead of calling Supabase Auth with no user context.
 */
export async function updatePasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();

  const session = await auth.getSession(supabase);
  if (!session) {
    return { error: "This link has expired or was already used. Request a new password reset link." };
  }

  try {
    await auth.updatePassword(supabase, password);
  } catch (err) {
    if (err instanceof auth.AuthServiceError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/dashboard");
}
