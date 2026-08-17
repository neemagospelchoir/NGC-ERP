"use server";

import { redirect } from "next/navigation";
import { auth } from "@ngc/services";
import { getSupabaseServiceRoleClient } from "@ngc/db";
import { createClient } from "@/lib/supabase/server";

export interface LoginFormState {
  error?: string;
}

/**
 * Server Action backing the /login form. Runs signInWithPassword against a
 * Server Action-scoped Supabase client (which, unlike a Server Component,
 * CAN write cookies — see lib/supabase/server.ts) so a successful sign-in
 * leaves the session cookie set before we redirect. Middleware.ts then
 * refreshes it on subsequent requests.
 *
 * The form's single "identifier" field accepts either an email or a
 * username — resolveLoginIdentifier() (service-role lookup, since an
 * unauthenticated request can't read public.users under RLS) turns a
 * username into the matching email first; an actual email is passed
 * through unchanged. See resolve-identifier.ts for why this never leaks
 * whether a given username exists.
 *
 * Takes/returns the (prevState, formData) shape expected by React's
 * useFormState so the client component can show the error inline without
 * its own fetch/try-catch.
 */
export async function signInAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextParam = String(formData.get("next") ?? "");
  const next = nextParam.startsWith("/") ? nextParam : "/dashboard";

  const email = await auth.resolveLoginIdentifier(getSupabaseServiceRoleClient(), identifier);

  const supabase = await createClient();

  try {
    await auth.signInWithPassword(supabase, { email, password });
  } catch (err) {
    if (err instanceof auth.AuthServiceError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  redirect(next);
}
