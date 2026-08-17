import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, type CookieAdapter } from "@ngc/db";

/**
 * Route protection + session refresh, per ARCHITECTURE.md S5 ("session
 * cookies are refreshed on every request via middleware; Server Components
 * cannot themselves write cookies"). This is Next.js' documented Supabase
 * SSR pattern: read the incoming request's cookies, let the Supabase client
 * refresh the access token if it's expired, and write any updated cookies
 * onto BOTH the request (so this same request sees them if middleware logic
 * reads cookies again) and the response (so the browser gets them).
 *
 * PUBLIC_PATHS lists exactly what an unauthenticated visitor may reach.
 * Everything else — most importantly the (erp) route group — requires a
 * session; unauthenticated requests are redirected to /login?next=<path>.
 * This is Layer 2 of defense-in-depth: RLS (Layer 1, enforced in Postgres
 * regardless of what this file does) is the non-bypassable boundary; this
 * middleware exists so a signed-out user gets a clean redirect instead of a
 * page full of RLS-empty-result blanks, and so (erp)/layout.tsx's own
 * server-side check (Layer 3) isn't the only thing standing between a
 * misconfigured page and a confusing UX.
 */
// /api/health (Phase 15 — ARCHITECTURE.md §17's uptime-monitoring bullet)
// is a fixed, public, unauthenticated endpoint by design — an external
// monitor holds no Supabase session at all — see its own route.ts comment.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/style-guide", "/api/health"];
// /join is the public, token-based Onboarding entry point (PRD §7.1,
// ARCHITECTURE.md §5.1) — applicants never get a Supabase Auth session, so
// this must stay reachable without a signed-in cookie. Every page under it
// enforces its own token+verification-contact check in application code
// (see packages/services/src/applications/token.ts) — this prefix exists
// only so middleware doesn't redirect an applicant to /login first.
// /invite is the equivalent public entry point for external Invitation
// organizers (PRD §7.24) — same token-based model, no Supabase Auth
// session ever, enforced by packages/services/src/invitations/token.ts.
const PUBLIC_PREFIXES = ["/auth/", "/_next/", "/favicon", "/join", "/invite"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const adapter: CookieAdapter = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }
      // Rebuild the response after mutating request.cookies, matching
      // Supabase's documented Next.js middleware recipe, then reapply the
      // Set-Cookie headers so the browser actually receives the refreshed
      // session.
      response = NextResponse.next({ request: { headers: request.headers } });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  };

  const supabase = createSupabaseServerClient(adapter);

  // getUser() (not getSession()) is deliberate: it revalidates the JWT
  // against Supabase Auth's server instead of trusting an unverified cookie
  // — see Supabase's SSR security guidance. This also has the side effect
  // of refreshing an expired access token via the refresh token, which is
  // what triggers adapter.setAll() above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Skip static assets and image optimization requests; everything else
  // (including API/Route Handlers under /auth) goes through the check
  // above via PUBLIC_PREFIXES.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
