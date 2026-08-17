import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError, mapSupabaseAuthError } from "./errors";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sends a password-reset email via Supabase Auth. `redirectTo` must point at
 * apps/web's /reset-password page (see apps/web/app/reset-password); it is
 * passed in by the caller rather than hardcoded here so this package never
 * needs to know the app's origin/domain (framework-agnostic rule).
 *
 * Always resolves without throwing on a "no such user" outcome — GoTrue
 * itself does not reveal whether the email exists, and neither should this
 * function, to avoid account-enumeration (spec S52). Genuine transport/
 * config errors (bad redirect URL, rate limit) still throw.
 */
export async function requestPasswordReset(
  client: SupabaseClient<Database>,
  email: string,
  redirectTo: string
): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    throw new AuthServiceError("Email is required.");
  }

  const { error } = await client.auth.resetPasswordForEmail(trimmed, { redirectTo });

  if (error) {
    // GoTrue only errors here for infra/config reasons (invalid redirect
    // URL, rate limiting) — a nonexistent email is a silent success by
    // design, both in GoTrue and in this wrapper.
    throw new AuthServiceError(mapSupabaseAuthError(error), error);
  }
}

/**
 * Sets a new password for the CURRENTLY authenticated session — used on the
 * /reset-password page after the user follows the emailed link (Supabase
 * exchanges that link for a temporary session before this runs) and on a
 * "change my password" settings form.
 */
export async function updatePassword(client: SupabaseClient<Database>, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AuthServiceError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { error } = await client.auth.updateUser({ password: newPassword });

  if (error) {
    throw new AuthServiceError(mapSupabaseAuthError(error), error);
  }
}
