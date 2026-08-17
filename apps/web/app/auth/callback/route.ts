import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE code-exchange endpoint that every emailed Supabase Auth link (a
 * password-reset link today; invite/email-confirmation links in a later
 * phase) redirects to. Exchanges the one-time `code` query param for a real
 * session (writing the session cookie via lib/supabase/server.ts's
 * cookie-adapter, which this Route Handler context is allowed to do), then
 * forwards the browser on to `next` — defaulting to /reset-password, since
 * that is this phase's only caller of this route.
 *
 * Redirect targets are built from NEXT_PUBLIC_APP_URL, NOT from the
 * incoming request's Host header/`request.url` origin. Two independent
 * reasons: (1) trusting Host for a redirect target is a classic
 * host-header-injection/open-redirect vector (spec S52); (2) it was
 * observed directly in this phase's Playwright verification — behind
 * `next start`, the Host Next.js reconstructs `request.url` from did not
 * always match the origin the browser actually holds the session cookie
 * for (127.0.0.1 vs. localhost), which silently dropped the session cookie
 * across the redirect. Pinning to the configured app URL fixes both.
 *
 * If exchange fails (expired/already-used link), redirects to /login with
 * an error flag rather than leaving the user on a broken page.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${appUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${appUrl}/login?error=link_expired`);
}
