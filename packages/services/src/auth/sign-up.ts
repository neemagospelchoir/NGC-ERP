import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError, mapSupabaseAuthError } from "./errors";

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  /** Optional handle the person can log in with instead of their email — see resolve-identifier.ts. */
  username?: string;
  /** Where Supabase's confirmation email link should send the browser back to (apps/web's /auth/callback). */
  emailRedirectTo?: string;
}

export interface SignUpResult {
  userId: string;
  /**
   * True once signUp() already returned a live session (email confirmations
   * disabled on this Supabase project, or the project auto-confirms). False
   * means Supabase emailed a confirmation link and the caller should tell
   * the person to check their inbox before they can sign in.
   */
  confirmedImmediately: boolean;
}

const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/i;

/**
 * Self-service registration for ordinary choir members (the /signup form).
 * Every account created through this function lands with the `choir_member`
 * role ONLY — role assignment happens exclusively in
 * supabase/migrations/0041_username_and_self_signup.sql's `auth.users`
 * trigger, which always grants `choir_member` and nothing else. This
 * function has no parameter or code path that could grant a higher role, by
 * design: a public sign-up form must never be able to self-escalate
 * privilege. An admin upgrades someone to a staff role afterward, the same
 * way they already do for dashboard-created accounts (see the role-code
 * reference in this project's onboarding notes).
 *
 * Mirrors sign-in.ts's shape deliberately (plain SupabaseClient<Database>,
 * same AuthServiceError contract) so Server Actions and tests can treat
 * sign-in/sign-up identically.
 */
export async function signUpWithPassword(
  client: SupabaseClient<Database>,
  input: SignUpInput
): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const displayName = input.displayName.trim();
  const username = input.username?.trim();

  if (!email || !password || !displayName) {
    throw new AuthServiceError("Name, email, and password are required.");
  }
  if (password.length < 8) {
    throw new AuthServiceError("Password must be at least 8 characters.");
  }
  if (username && !USERNAME_PATTERN.test(username)) {
    throw new AuthServiceError(
      "Username must be 3-32 characters and contain only letters, numbers, dots, dashes, or underscores."
    );
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      // Read by the 0041 migration's trigger via NEW.raw_user_meta_data —
      // keep these two key names in sync with that file if either changes.
      data: { display_name: displayName, username: username || null },
      emailRedirectTo: input.emailRedirectTo,
    },
  });

  if (error) {
    throw new AuthServiceError(mapSupabaseAuthError(error), error);
  }
  if (!data.user) {
    throw new AuthServiceError("Sign-up did not return a user.");
  }

  return { userId: data.user.id, confirmedImmediately: Boolean(data.session) };
}
