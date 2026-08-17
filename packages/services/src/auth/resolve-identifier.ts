import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";

const EMAIL_PATTERN = /.+@.+\..+/;

/**
 * The /login form (apps/web/app/login) accepts either an email or a
 * username. This resolves whichever the person typed into the email
 * signInWithPassword() actually needs.
 *
 * Deliberately takes the SERVICE-ROLE client (@ngc/db's
 * getSupabaseServiceRoleClient), not the request-scoped anon client: the
 * `users_select_self` RLS policy (0002_rbac.sql) only ever exposes a
 * public.users row to its own owner (`auth.uid() = id`), which by
 * definition isn't set yet for someone who hasn't signed in. Bypassing RLS
 * here is a narrow, read-only, single-column lookup — it never returns
 * anything an attacker couldn't already confirm one bit at a time via the
 * sign-in form's own error message, and every caller still goes through the
 * normal signInWithPassword() check right after this, so a wrong username
 * fails exactly like a wrong email does (see the fallback below).
 */
export async function resolveLoginIdentifier(
  serviceClient: SupabaseClient<Database>,
  identifier: string
): Promise<string> {
  const trimmed = identifier.trim();
  if (EMAIL_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const { data } = await serviceClient.from("users").select("email").eq("username", trimmed).maybeSingle();

  // No matching username: return the original text unchanged rather than
  // throwing. signInWithPassword() will then fail with the same generic
  // "Incorrect email or password" message it always uses — this function
  // must never let "no such username" surface as a different error from
  // "wrong password", or it becomes a username-enumeration oracle.
  return data?.email ?? trimmed;
}
