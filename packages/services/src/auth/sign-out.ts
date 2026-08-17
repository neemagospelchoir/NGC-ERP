import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { AuthServiceError } from "./errors";

/**
 * Signs the current session out. The caller (middleware / a Server Action
 * bound to a "Sign out" button) is responsible for clearing the Set-Cookie
 * response afterward — this function only talks to Supabase Auth, per the
 * framework-agnostic rule for packages/services.
 */
export async function signOut(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw new AuthServiceError("Sign-out failed. Please try again.", error);
  }
}
