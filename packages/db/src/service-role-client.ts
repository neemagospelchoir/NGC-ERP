import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Elevated, RLS-bypassing client for trusted server-only operations (e.g.
 * approving an application and issuing a Member ID in one transaction,
 * processing an applicant/organizer's public token-based submission — see
 * ARCHITECTURE.md S5.1/S8). The `server-only` import makes it a build error
 * to ever import this file from client code, in addition to the service
 * role key itself only ever living in a server-side environment variable
 * (never NEXT_PUBLIC_-prefixed, never in a client bundle — spec S52).
 *
 * Every call site using this client is expected to perform its own
 * authorization check in application code (the whole point of using it is
 * that RLS is bypassed) — see packages/services' authorize() convention.
 */
export function getSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server environment only) — see .env.example."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
