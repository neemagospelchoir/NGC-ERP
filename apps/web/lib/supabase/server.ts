import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient, type CookieAdapter } from "@ngc/db";

/**
 * apps/web's binding of @ngc/db's framework-agnostic server client factory
 * to Next.js' next/headers cookies() API. This is the ONLY file in apps/web
 * that should import next/headers' cookies() for auth purposes — Server
 * Components and Route Handlers call this, not createSupabaseServerClient
 * directly, so the cookie-adapter wiring lives in exactly one place.
 *
 * Safe to call from a Server Component (read-only render) or a Route
 * Handler/Server Action (can also write cookies) — the underlying
 * CookieAdapter.setAll() already swallows the "cannot mutate cookies from a
 * Server Component" error (see @ngc/db/server-client.ts), relying on
 * middleware.ts to refresh the session cookie on every request instead.
 *
 * Phase 16 (Next.js 14 -> 15 upgrade): `cookies()` became async in Next 15
 * (one of that release's own headline breaking changes — every Dynamic API
 * that depends on request data moved from a plain return value to a
 * Promise). This function is therefore `async` now too, and every one of
 * its ~159 call sites across apps/web was updated to `await createClient()`
 * — deliberately NOT using the `UnsafeUnwrappedCookies` escape hatch Next's
 * own official codemod falls back to when it can't prove a call site is
 * safe to convert, since that escape hatch is explicitly documented as
 * temporary and slated for removal in a future major version.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const adapter: CookieAdapter = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) {
        cookieStore.set(name, value, options);
      }
    },
  };

  return createSupabaseServerClient(adapter);
}
