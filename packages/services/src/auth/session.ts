import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";

/**
 * Thin wrapper over `auth.getSession()` — exists so call sites depend on
 * this package's auth module instead of reaching into `@ngc/db`/
 * `@supabase/supabase-js` directly, keeping the client library swappable in
 * one place if it's ever needed (spec S3: services stay framework-agnostic
 * and dependency-light for callers).
 *
 * Returns null rather than throwing when there is no session — "not signed
 * in" is an expected, common state, not an error.
 */
export async function getSession(client: SupabaseClient<Database>): Promise<Session | null> {
  const {
    data: { session },
  } = await client.auth.getSession();
  return session;
}
