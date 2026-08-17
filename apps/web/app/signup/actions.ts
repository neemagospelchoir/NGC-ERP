"use server";

import { redirect } from "next/navigation";
import { auth } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface SignUpFormState {
  error?: string;
  needsEmailConfirmation?: boolean;
}

/**
 * Server Action backing the /signup form. Every account this creates lands
 * with the `choir_member` role only — see
 * supabase/migrations/0041_username_and_self_signup.sql's auth.users
 * trigger, the single place role assignment happens for a self-registered
 * user. An admin upgrades someone to a staff role afterward (Supabase
 * dashboard/SQL), same as for a dashboard-created account.
 *
 * Runs through the Server Action-scoped Supabase client (can write cookies,
 * unlike a Server Component — see lib/supabase/server.ts) so that if
 * Supabase returns a session immediately (email confirmations disabled on
 * this project), the person is already signed in when we redirect them.
 */
export async function signUpAction(_prevState: SignUpFormState, formData: FormData): Promise<SignUpFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const usernameRaw = String(formData.get("username") ?? "").trim();
  const username = usernameRaw === "" ? undefined : usernameRaw;

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();

  let confirmedImmediately: boolean;
  try {
    const result = await auth.signUpWithPassword(supabase, {
      email,
      password,
      displayName,
      username,
      emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
    });
    confirmedImmediately = result.confirmedImmediately;
  } catch (err) {
    if (err instanceof auth.AuthServiceError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  if (confirmedImmediately) {
    redirect("/dashboard");
  }
  return { needsEmailConfirmation: true };
}
