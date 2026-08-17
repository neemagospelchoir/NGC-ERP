"use server";

import { auth } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface ForgotPasswordFormState {
  error?: string;
  submitted?: boolean;
}

/**
 * Always resolves to `{ submitted: true }` on any input that passes basic
 * validation — see auth/password-reset.ts's doc comment: GoTrue does not
 * reveal whether an email is registered, and neither does this action, to
 * avoid account enumeration (spec S52).
 */
export async function requestPasswordResetAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData
): Promise<ForgotPasswordFormState> {
  const email = String(formData.get("email") ?? "");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

  const supabase = await createClient();

  try {
    await auth.requestPasswordReset(supabase, email, redirectTo);
  } catch (err) {
    if (err instanceof auth.AuthServiceError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  return { submitted: true };
}
