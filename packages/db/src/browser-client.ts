"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * One client per browser tab (memoized). Reads config from env vars only —
 * never hardcode a Supabase URL/key (spec S52, S60). The anon key is safe to
 * ship to the browser by design (it is subject to RLS); the service role key
 * must NEVER appear in any file imported by browser code.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set — see .env.example. Never hardcode these."
    );
  }

  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
