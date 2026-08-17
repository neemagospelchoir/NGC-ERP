import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: Record<string, unknown> }[]): void;
}

/**
 * Framework-agnostic server-side Supabase client factory (packages/services
 * and packages/db stay framework-agnostic per ARCHITECTURE.md S3 — the
 * caller supplies a cookie adapter; apps/web wires this to next/headers'
 * cookies() in Server Components/Route Handlers, and to the
 * request/response cookie pair inside middleware.ts).
 *
 * Uses the anon key + RLS, exactly like the browser client — this is the
 * client used for user-scoped SSR reads (e.g. rendering a page with the
 * signed-in user's own data). It is NOT the elevated service-role client;
 * that lives in server-only route handlers that never import browser code
 * (see service-role-client.ts).
 */
export function createSupabaseServerClient(cookies: CookieAdapter) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set — see .env.example. Never hardcode these."
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
        try {
          cookies.setAll(cookiesToSet);
        } catch {
          // setAll is called from a Server Component in some render paths,
          // where Next.js disallows mutating cookies — safe to ignore
          // because middleware.ts is what actually refreshes the session
          // cookie on every request (see apps/web/middleware.ts).
        }
      },
    },
    global: {
      // Phase 7.4 hardening: added while chasing a stale-status test
      // failure (discipline.spec.ts's restore test) that turned out to be
      // caused by something else entirely (see mock-gotrue-server.mjs's
      // `.single()` fix) — but investigating it surfaced a real, separate
      // risk worth closing anyway. Next.js 14 defaults every `fetch()` call
      // to `cache: "force-cache"` UNLESS told otherwise, regardless of
      // whether the route is dynamically rendered (using `cookies()` opts
      // the ROUTE into per-request rendering, but does NOT change the
      // cache option Next.js applies to individual fetch() calls inside
      // it — those are two separate mechanisms). supabase-js issues plain
      // `fetch()` calls with no cache option of its own, so every
      // PostgREST read this client makes was silently eligible for Next's
      // Data Cache to serve back a stale response after a mutation — a
      // real correctness risk for an ERP regardless of whether it was the
      // proven cause of any specific bug so far (a user could see a stale
      // status after someone else just changed it). Forcing `no-store`
      // here makes every read from this client always hit the database.
      fetch: (input: any, init: any) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
