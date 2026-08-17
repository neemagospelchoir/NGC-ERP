import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError, mapSupabaseAuthError } from "./errors";

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInResult {
  userId: string;
}

/**
 * Signs a user in with email + password against Supabase Auth. This is the
 * ONLY authentication factor the org has asked for in Phase 6 (spec S9 lists
 * MFA/SSO as later-phase options, not a Phase 6 requirement) — do not add
 * MFA prompts or SSO redirects here without an explicit spec update.
 *
 * Deliberately takes a plain SupabaseClient<Database> (browser or server,
 * anon key + RLS) rather than importing a client factory itself, so this
 * function stays framework-agnostic and trivially testable with a fake
 * client (see auth.test.ts / __fixtures__/fake-supabase-client.ts).
 */
export async function signInWithPassword(
  client: SupabaseClient<Database>,
  input: SignInInput
): Promise<SignInResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    throw new AuthServiceError("Email and password are required.");
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new AuthServiceError(mapSupabaseAuthError(error), error);
  }
  if (!data.user) {
    throw new AuthServiceError("Sign-in did not return a user.");
  }

  return { userId: data.user.id };
}
