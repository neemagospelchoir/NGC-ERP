import { createClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { secureChunkedStorage } from "./secure-storage";

/**
 * Mobile's own Supabase client factory — NOT `@ngc/db`'s
 * `getSupabaseBrowserClient`/`createSupabaseServerClient`, both of which are
 * built on `@supabase/ssr` and assume a browser `document`/cookie jar or a
 * Next.js `cookies()` adapter (ARCHITECTURE.md S3 keeps `packages/db`
 * framework-agnostic in *principle*, but `@supabase/ssr` itself has no React
 * Native storage adapter). React Native has neither, so this app talks to
 * plain `@supabase/supabase-js` directly and supplies a SecureStore-backed
 * auth session store (see ./secure-storage.ts — NOT plain AsyncStorage,
 * which is unencrypted on-device; a security review of this phase caught
 * that gap before ship, see docs/PHASE_12_1.md S4). `Database` is still
 * imported from `@ngc/db` so the generated schema types (and any future
 * `pnpm --filter @ngc/db gen:types` run) stay a single source of truth
 * shared with web, even though the client construction differs.
 *
 * One instance for the whole app's lifetime (module-level singleton, same
 * lazy-memoization shape as `getSupabaseBrowserClient` — deferred into a
 * function rather than thrown at module-eval time so importing this file
 * never crashes a tool that only needs to resolve the module graph, e.g.
 * Metro's own `expo export` bundling step).
 */
let client: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set — see apps/mobile/.env.example. Never hardcode these."
    );
  }

  client = createClient<Database>(url, anonKey, {
    auth: {
      storage: secureChunkedStorage,
      autoRefreshToken: true,
      persistSession: true,
      // There is no URL bar on a native app to carry an OAuth/magic-link
      // redirect fragment into — detection is a browser-only concept.
      detectSessionInUrl: false,
    },
  });
  return client;
}
